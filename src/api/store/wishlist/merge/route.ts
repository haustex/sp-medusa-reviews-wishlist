import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { noStore } from "../../../../lib/http"
import { mergeWishlist, toView } from "../../../../lib/wishlists"

/** After login: move the guest wishlist (token) into the customer's. The token stops working. */
export const POST = async (req: AuthenticatedMedusaRequest<{ token: string }>, res: MedusaResponse) => {
  noStore(res)
  const wishlist = await mergeWishlist(req.scope, req.auth_context.actor_id, req.validatedBody.token)
  res.json({ wishlist: await toView(req.scope, wishlist) })
}
