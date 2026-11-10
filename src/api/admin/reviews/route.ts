import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../modules/reviews"
import type ReviewsModuleService from "../../../modules/reviews/service"
import { toAdminReview } from "../../../lib/serialize"
import type { AdminListReviewsType } from "../../validators"

/** Titles of products and display ids of orders for the rows on one page (one query each). */
export async function decorate(req: AuthenticatedMedusaRequest, rows: { product_id: string; order_id: string }[]) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productIds = [...new Set(rows.map((r) => r.product_id))]
  const orderIds = [...new Set(rows.map((r) => r.order_id))]
  const titles = new Map<string, string>()
  const displayIds = new Map<string, number>()
  if (productIds.length) {
    const { data } = await query.graph({ entity: "product", fields: ["id", "title"], filters: { id: productIds } })
    for (const p of data as { id: string; title: string }[]) titles.set(p.id, p.title)
  }
  if (orderIds.length) {
    const { data } = await query.graph({ entity: "order", fields: ["id", "display_id"], filters: { id: orderIds } })
    for (const o of data as { id: string; display_id: number }[]) displayIds.set(o.id, o.display_id)
  }
  return { titles, displayIds }
}

const ORDERABLE = new Set(["created_at", "updated_at", "rating", "status", "approved_at"])

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = req.validatedQuery as AdminListReviewsType
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const filters: Record<string, unknown> = {}
  if (q.status) filters.status = q.status
  if (q.product_id) filters.product_id = q.product_id
  if (q.order_id) filters.order_id = q.order_id
  if (q.customer_id) filters.customer_id = q.customer_id
  if (q.rating) filters.rating = q.rating
  if (q.verified !== undefined) filters.verified = q.verified
  if (q.q) {
    const like = `%${q.q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    filters.$or = [{ body: { $ilike: like } }, { title: { $ilike: like } }, { display_name: { $ilike: like } }, { email: { $ilike: like } }]
  }
  const take = q.limit ?? 20
  const skip = q.offset ?? 0
  const [field, dir] = (q.order ?? "-created_at").startsWith("-") ? [(q.order ?? "-created_at").slice(1), "DESC"] : [q.order ?? "created_at", "ASC"]
  const order = { [ORDERABLE.has(field) ? field : "created_at"]: dir as "ASC" | "DESC" }
  let [rows, count] = await service.listAndCountReviews(filters, { relations: ["images", "reply"], order, take, skip })
  if (q.has_images !== undefined) rows = rows.filter((r) => !!(r.images ?? []).length === q.has_images)
  const { titles, displayIds } = await decorate(req, rows)
  res.json({
    reviews: rows.map((r) => toAdminReview(r, { product_title: titles.get(r.product_id) ?? null, order_display_id: displayIds.get(r.order_id) ?? null })),
    count,
    limit: take,
    offset: skip,
  })
}
