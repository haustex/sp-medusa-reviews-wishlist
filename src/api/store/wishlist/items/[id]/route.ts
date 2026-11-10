import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { noStore } from "../../../../../lib/http"
import { findWishlist, removeItem, toView } from "../../../../../lib/wishlists"

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  noStore(res)
  const who = { customer_id: req.auth_context?.actor_id, token: req.headers["x-wishlist-token"] }
  const wishlist = await findWishlist(req.scope, who)
  if (!wishlist) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No wishlist")
  await removeItem(req.scope, wishlist, req.params.id)
  res.json({ wishlist: await toView(req.scope, await findWishlist(req.scope, who)) })
}
