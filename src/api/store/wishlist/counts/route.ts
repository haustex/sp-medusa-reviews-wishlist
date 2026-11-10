import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { counts } from "../../../../lib/wishlists"

/** "{ counts: { prod_x: 12 } }" — how many wishlists hold each product (zeros when the option is off). */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ids = ([] as string[]).concat((req.validatedQuery as { product_id: string | string[] }).product_id)
  res.json({ counts: await counts(req.scope, ids) })
}
