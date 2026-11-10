import type { INotificationModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../modules/reviews"
import type ReviewsModuleService from "../modules/reviews/service"
import { loadOrderForReview, ruleFor, type OrderForReview, type ReviewableItem } from "./eligibility"
import { getOptions, type ResolvedOptions } from "./options"
import { hashEmail, hashToken, newToken, signId } from "./tokens"
import { displayName } from "./text"
import { ReviewEvents } from "./events"

const DAY = 86_400_000
const MAX_ATTEMPTS = 3
export const UNSUBSCRIBE_PURPOSE = "review-unsubscribe"

const service = (c: MedusaContainer) => c.resolve<ReviewsModuleService>(REVIEWS_MODULE)

export async function isOptedOut(container: MedusaContainer, email: string): Promise<boolean> {
  const rows = await service(container).listReviewOptOuts({ email_hash: hashEmail(email) }, { take: 1 })
  return rows.length > 0
}

export async function optOut(container: MedusaContainer, email: string, source: string): Promise<void> {
  const s = service(container)
  const email_hash = hashEmail(email)
  const existing = await s.listReviewOptOuts({ email_hash }, { take: 1 })
  if (!existing.length) await s.createReviewOptOuts({ email_hash, source })
  const pending = await s.listReviewRequests({ email_hash, status: ["scheduled", "sent"] }, { take: null })
  if (pending.length) await s.updateReviewRequests(pending.map((r) => ({ id: r.id, status: "opted_out" as const, token_hash: null })))
}

/** Items of the order that may still be reviewed (eligible and not reviewed yet). */
export async function openItems(container: MedusaContainer, order: OrderForReview): Promise<ReviewableItem[]> {
  if (!order.items.some((i) => i.eligible)) return []
  return (await unreviewedItems(container, order)).filter((i) => i.eligible)
}

/**
 * Items of the order without a review yet, eligible or not. A magic link stays valid while this is non-empty, so a
 * partially shipped order can be reviewed item by item from the same e-mail.
 */
export async function unreviewedItems(container: MedusaContainer, order: OrderForReview): Promise<ReviewableItem[]> {
  if (!order.items.length) return []
  const reviewed = await service(container).listReviews({ order_id: order.id }, { select: ["order_item_id"], take: null })
  const done = new Set(reviewed.map((r) => r.order_item_id))
  return order.items.filter((i) => !done.has(i.order_item_id))
}

export type ScheduleResult = { status: "scheduled" | "exists" | "disabled" | "no_order" | "no_email" | "not_eligible" | "opted_out"; request_id?: string }

/**
 * Called on shipment / delivery / completion: creates the order's one review request (scheduled at trigger time +
 * delay) when the rule's trigger is reached and the order has reviewable items. Idempotent per order.
 */
export async function scheduleReviewRequest(container: MedusaContainer, orderId: string, options: ResolvedOptions = getOptions(container)): Promise<ScheduleResult> {
  if (!options.review_requests.enabled) return { status: "disabled" }
  const s = service(container)
  const existing = await s.listReviewRequests({ order_id: orderId }, { take: 1 })
  if (existing.length) return { status: "exists", request_id: existing[0].id }

  const probe = await loadOrderForReview(container, orderId, options.review_requests.trigger)
  if (!probe) return { status: "no_order" }
  const rule = ruleFor(options.review_requests, probe)
  const order = rule.trigger === options.review_requests.trigger ? probe : await loadOrderForReview(container, orderId, rule.trigger)
  if (!order?.email) return { status: "no_email" }
  const open = await openItems(container, order)
  if (!open.length) return { status: "not_eligible" }

  const optedOut = await isOptedOut(container, order.email)
  const request = await s.createReviewRequests({
    order_id: order.id,
    customer_id: order.customer_id,
    email: order.email,
    email_hash: hashEmail(order.email),
    trigger: rule.trigger,
    delay_days: rule.delay_days,
    scheduled_at: new Date(Date.now() + rule.delay_days * DAY),
    status: optedOut ? "opted_out" : "scheduled",
    region_id: order.region_id,
    sales_channel_id: order.sales_channel_id,
  })
  if (optedOut) return { status: "opted_out", request_id: request.id }
  try {
    await container.resolve(Modules.EVENT_BUS).emit({ name: ReviewEvents.REQUEST_SCHEDULED, data: { id: request.id, order_id: order.id } })
  } catch {
    // event bus unavailable (e.g. during tests without one): the request is scheduled regardless
  }
  return { status: "scheduled", request_id: request.id }
}

export type SendSummary = { sent: number; skipped: number; failed: number; expired: number }

/**
 * Sends every due request: one e-mail per order with a fresh magic link; re-checks eligibility, opt-out and that
 * something is still unreviewed. Also expires links past their TTL. Returns counts.
 */
export async function sendDueReviewRequests(container: MedusaContainer, limit = 100, now = new Date()): Promise<SendSummary> {
  const options = getOptions(container)
  const s = service(container)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const summary: SendSummary = { sent: 0, skipped: 0, failed: 0, expired: 0 }

  const stale = await s.listReviewRequests({ status: "sent", expires_at: { $lt: now } }, { select: ["id"], take: null })
  if (stale.length) {
    await s.updateReviewRequests(stale.map((r) => ({ id: r.id, status: "expired" as const, token_hash: null })))
    summary.expired = stale.length
  }

  if (!options.review_requests.enabled) return summary
  const due = await s.listReviewRequests({ status: "scheduled", scheduled_at: { $lte: now } }, { order: { scheduled_at: "ASC" }, take: limit })
  if (!due.length) return summary

  if (!options.review_requests.link_url) {
    logger.warn(`[reviews] ${due.length} review request(s) due but review_requests.link_url is not configured; nothing sent`)
    return summary
  }
  const notifications = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)

  for (const request of due) {
    try {
      if (await isOptedOut(container, request.email)) {
        await s.updateReviewRequests({ id: request.id, status: "opted_out" })
        summary.skipped++
        continue
      }
      const order = await loadOrderForReview(container, request.order_id, request.trigger as ResolvedOptions["review_requests"]["trigger"])
      const open = order ? await openItems(container, order) : []
      if (!order || !open.length) {
        await s.updateReviewRequests({ id: request.id, status: "skipped", last_error: order ? "nothing left to review" : "order not found" })
        summary.skipped++
        continue
      }
      const token = newToken()
      const expires_at = new Date(now.getTime() + options.review_requests.token_ttl_days * DAY)
      const review_url = options.review_requests.link_url.replace("{token}", encodeURIComponent(token))
      const unsubscribe_url = `${options.review_requests.backend_url ?? ""}/reviews/unsubscribe/${signId(request.id, UNSUBSCRIBE_PURPOSE, options.secret)}`
      await notifications.createNotifications({
        to: request.email,
        channel: "email",
        template: options.review_requests.template,
        trigger_type: "review.request",
        resource_id: request.order_id,
        resource_type: "order",
        receiver_id: request.customer_id ?? undefined,
        ...(options.review_requests.from ? { from: options.review_requests.from } : {}),
        data: {
          order_id: order.id,
          display_id: order.display_id,
          first_name: order.first_name,
          display_name: displayName(order.first_name, order.last_name, options.display_name),
          items: open.map((i) => ({ order_item_id: i.order_item_id, product_id: i.product_id, title: i.title, product_title: i.product_title, thumbnail: i.thumbnail })),
          review_url,
          unsubscribe_url,
          expires_at: expires_at.toISOString(),
          locale: request.locale,
          region_id: order.region_id,
          sales_channel_id: order.sales_channel_id,
        },
      })
      await s.updateReviewRequests({ id: request.id, status: "sent", token_hash: hashToken(token), sent_at: now, expires_at, attempts: request.attempts + 1, last_error: null })
      summary.sent++
      try {
        await container.resolve(Modules.EVENT_BUS).emit({ name: ReviewEvents.REQUEST_SENT, data: { id: request.id, order_id: request.order_id } })
      } catch {
        // see scheduleReviewRequest
      }
    } catch (e) {
      const attempts = request.attempts + 1
      const message = String((e as Error)?.message ?? e).slice(0, 300)
      await s.updateReviewRequests({ id: request.id, attempts, last_error: message, status: attempts >= MAX_ATTEMPTS ? "failed" : "scheduled" })
      logger.warn(`[reviews] review request ${request.id} (order ${request.order_id}) attempt ${attempts} failed: ${message}`)
      summary.failed++
    }
  }
  return summary
}

export type TokenContext = { request: Awaited<ReturnType<ReviewsModuleService["listReviewRequests"]>>[number]; order: OrderForReview; open: ReviewableItem[] }

/**
 * The order behind a magic link, or a 404-style error when the link is unknown, used or expired. Resolving never
 * consumes the link: it can be opened, refreshed and reopened on another device until every item of the order has a
 * review (see `consumeRequestTokenIfDone`) or it expires.
 */
export async function resolveRequestToken(container: MedusaContainer, token: string): Promise<TokenContext> {
  const [request] = await service(container).listReviewRequests({ token_hash: hashToken(token) }, { take: 1 })
  const invalid = () => new MedusaError(MedusaError.Types.NOT_FOUND, "This review link is invalid, used or expired")
  if (!request || request.status !== "sent") throw invalid()
  if (request.expires_at && new Date(request.expires_at) < new Date()) throw invalid()
  const order = await loadOrderForReview(container, request.order_id, request.trigger as ResolvedOptions["review_requests"]["trigger"])
  if (!order) throw invalid()
  const open = await openItems(container, order)
  return { request, order, open }
}

/** Marks the link used (token hash dropped) once no item of the order is left to review. Returns whether it did. */
export async function consumeRequestTokenIfDone(container: MedusaContainer, requestId: string, order: OrderForReview): Promise<boolean> {
  const left = await unreviewedItems(container, order)
  if (left.length) return false
  await service(container).updateReviewRequests({ id: requestId, status: "used", used_at: new Date(), token_hash: null })
  return true
}
