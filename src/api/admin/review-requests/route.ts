import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../modules/reviews"
import type ReviewsModuleService from "../../../modules/reviews/service"

type Q = { status?: string | string[]; order_id?: string; customer_id?: string; limit?: number; offset?: number }

/** Review-request e-mails: scheduled, sent, used, … Tokens are never returned (only their existence). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = req.validatedQuery as Q
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const filters: Record<string, unknown> = {}
  if (q.status) filters.status = q.status
  if (q.order_id) filters.order_id = q.order_id
  if (q.customer_id) filters.customer_id = q.customer_id
  const take = q.limit ?? 20
  const skip = q.offset ?? 0
  const [rows, count] = await service.listAndCountReviewRequests(filters, { order: { scheduled_at: "DESC" }, take, skip })
  res.json({
    review_requests: rows.map(({ token_hash, email_hash: _h, ...r }) => ({ ...r, has_token: !!token_hash })),
    count,
    limit: take,
    offset: skip,
  })
}
