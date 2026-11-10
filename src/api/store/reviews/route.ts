import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../modules/reviews"
import type ReviewsModuleService from "../../../modules/reviews/service"
import { getOptions } from "../../../lib/options"
import { toStoreReview } from "../../../lib/serialize"
import { checkHoneypot, clientIpHash, limit, noStore } from "../../../lib/http"
import { displayName, pickLocale, sanitizeText, splitName } from "../../../lib/text"
import { loadOrderForReview, ruleFor, type OrderForReview } from "../../../lib/eligibility"
import { consumeRequestToken, openItems, resolveRequestToken } from "../../../lib/review-requests"
import { createReviewsWorkflow } from "../../../workflows/create-reviews"
import type { StoreCreateReviewsType, StoreListReviewsType } from "../../validators"

/** Approved reviews of one or more products. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = req.validatedQuery as StoreListReviewsType
  const options = getOptions(req.scope)
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const take = Math.min(q.limit ?? 10, options.reviews.max_page_size)
  const skip = q.offset ?? 0
  const order: Record<string, "ASC" | "DESC"> =
    q.order === "oldest" ? { created_at: "ASC" } : q.order === "highest" ? { rating: "DESC", created_at: "DESC" } : q.order === "lowest" ? { rating: "ASC", created_at: "DESC" } : { created_at: "DESC" }
  const filters: Record<string, unknown> = { product_id: q.product_id, status: "approved" }
  if (q.rating) filters.rating = q.rating
  const [rows, count] = await service.listAndCountReviews(filters, { relations: ["images", "reply"], order, take, skip })
  const reviews = rows.map(toStoreReview).filter((r) => !q.with_images || r.images.length)
  res.json({ reviews, count, limit: take, offset: skip })
}

type Body = StoreCreateReviewsType

/**
 * Create reviews for purchased items. Either a logged-in customer with `order_id` (the order must be theirs) or a
 * magic-link `request_token` (guest). Each item can be reviewed once; the item must have reached the configured
 * trigger state (shipped / delivered / completed).
 */
export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  noStore(res)
  await limit(req, "store.reviews.create")
  checkHoneypot(req as unknown as MedusaRequest<Record<string, unknown>>)
  const options = getOptions(req.scope)
  const body = req.validatedBody
  const customerId = req.auth_context?.actor_id ?? null

  let order: OrderForReview
  let requestId: string | null = null
  if (body.request_token) {
    const ctx = await resolveRequestToken(req.scope, body.request_token)
    order = ctx.order
    requestId = ctx.request.id
    if (body.order_id && body.order_id !== order.id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "order_id does not match the review link")
  } else {
    if (!customerId) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Log in or use the review link from your e-mail")
    if (!body.order_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "order_id is required")
    const probe = await loadOrderForReview(req.scope, body.order_id, options.review_requests.trigger)
    if (!probe || probe.customer_id !== customerId) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
    const rule = ruleFor(options.review_requests, probe)
    order = rule.trigger === options.review_requests.trigger ? probe : ((await loadOrderForReview(req.scope, body.order_id, rule.trigger)) as OrderForReview)
  }

  const open = new Map((await openItems(req.scope, order)).map((i) => [i.order_item_id, i]))
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const owner = customerId ?? `req:${requestId}`
  const uploadIds = body.reviews.flatMap((r) => r.upload_ids ?? [])
  const uploads = uploadIds.length ? await service.listReviewUploads({ id: uploadIds, owner }) : []
  const ownedUploads = new Set(uploads.map((u) => u.id))
  const seen = new Set<string>()
  const locale = pickLocale(body.locale, req.headers["accept-language"])
  const ipHash = clientIpHash(req, options.privacy.ip_salt)
  const [first, last] = [order.first_name, order.last_name]

  const reviews = body.reviews.map((r) => {
    const item = open.get(r.order_item_id)
    if (!item) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Item ${r.order_item_id} cannot be reviewed: not in this order, not yet ${order.status === "completed" ? "eligible" : "shipped/delivered"}, or already reviewed`)
    if (seen.has(r.order_item_id)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Item ${r.order_item_id} appears twice`)
    seen.add(r.order_item_id)
    const text = sanitizeText(r.body, options.reviews.max_body_length)
    if (Array.from(text).length < options.reviews.min_body_length) throw new MedusaError(MedusaError.Types.INVALID_DATA, `The review text must have at least ${options.reviews.min_body_length} characters`)
    const title = r.title ? sanitizeText(r.title, options.reviews.max_title_length) || null : null
    const ups = (r.upload_ids ?? []).filter((id, i, all) => all.indexOf(id) === i)
    for (const id of ups) if (!ownedUploads.has(id)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Upload ${id} not found`)
    if (ups.length > options.reviews.max_photos) throw new MedusaError(MedusaError.Types.INVALID_DATA, `At most ${options.reviews.max_photos} photo(s) per review`)
    const custom = r.display_name ? splitName(r.display_name) : null
    return {
      product_id: item.product_id,
      variant_id: item.variant_id,
      order_id: order.id,
      order_item_id: item.order_item_id,
      customer_id: order.customer_id,
      email: order.email,
      display_name: custom ? displayName(custom[0], custom[1], options.display_name) : displayName(first, last, options.display_name),
      rating: r.rating,
      title,
      body: text,
      locale,
      ip_hash: ipHash,
      upload_ids: ups,
    }
  })

  const { result: ids } = await createReviewsWorkflow(req.scope).run({ input: { reviews, auto_approve: options.auto_approve } })
  if (requestId && open.size === seen.size) await consumeRequestToken(req.scope, requestId)
  else if (requestId) {
    // the link stays valid for the items not reviewed yet (single use once everything is reviewed)
  }
  const created = await service.listReviews({ id: ids }, { relations: ["images", "reply"] })
  res.status(201).json({ reviews: created.map((r) => ({ ...toStoreReview(r), status: r.status, order_item_id: r.order_item_id })) })
}
