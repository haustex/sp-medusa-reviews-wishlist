import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../../../modules/reviews"
import type ReviewsModuleService from "../../../../../modules/reviews/service"
import { noStore } from "../../../../../lib/http"
import { toOwnReview } from "../../../../../lib/serialize"

/** The logged-in customer's own reviews, every status. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  noStore(res)
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const rows = await service.listReviews({ customer_id: req.auth_context.actor_id }, { relations: ["images", "reply"], order: { created_at: "DESC" }, take: 200 })
  res.json({ reviews: rows.map(toOwnReview) })
}
