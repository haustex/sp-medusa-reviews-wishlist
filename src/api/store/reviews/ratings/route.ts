import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../../modules/reviews"
import type ReviewsModuleService from "../../../../modules/reviews/service"
import { toRating } from "../../../../lib/serialize"

/** Stored aggregates (average, count, 1–5 distribution) for up to 100 products in one call. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ids = ([] as string[]).concat((req.validatedQuery as { product_id: string | string[] }).product_id)
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const rows = await service.listProductRatings({ product_id: ids }, { take: null })
  const byId = new Map(rows.map((r) => [r.product_id, r]))
  res.json({ ratings: ids.map((id) => toRating(byId.get(id), id)) })
}
