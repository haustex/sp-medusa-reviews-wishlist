import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refreshProductRatingWorkflow } from "../../../../../workflows/refresh-product-rating"

/** Recompute stored aggregates (after an import or a manual change). */
export const POST = async (req: AuthenticatedMedusaRequest<{ product_ids: string[] }>, res: MedusaResponse) => {
  const { result } = await refreshProductRatingWorkflow(req.scope).run({ input: { product_ids: req.validatedBody.product_ids } })
  res.json({ ratings: result })
}
