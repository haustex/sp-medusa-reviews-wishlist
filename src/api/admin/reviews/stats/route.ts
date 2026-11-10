import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../../modules/reviews"
import type ReviewsModuleService from "../../../../modules/reviews/service"
import { toRating } from "../../../../lib/serialize"

/** Counts per status (for the moderation page) and, with ?product_id, that product's aggregate. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const productId = typeof req.query.product_id === "string" ? req.query.product_id : null
  const base = productId ? { product_id: productId } : {}
  const [pending, approved, rejected] = await Promise.all(
    (["pending", "approved", "rejected"] as const).map(async (status) => (await service.listAndCountReviews({ ...base, status }, { select: ["id"], take: 1 }))[1])
  )
  const out: Record<string, unknown> = { pending, approved, rejected, total: pending + approved + rejected }
  if (productId) {
    const [rating] = await service.listProductRatings({ product_id: productId }, { take: 1 })
    out.rating = toRating(rating, productId)
  }
  res.json(out)
}
