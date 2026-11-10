import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { noStore } from "../../../lib/http"
import { findWishlist, toView } from "../../../lib/wishlists"

/** The customer's wishlist, or the guest wishlist of the `x-wishlist-token` header; `{ wishlist: null }` when none. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  noStore(res)
  const wishlist = await findWishlist(req.scope, { customer_id: req.auth_context?.actor_id, token: req.headers["x-wishlist-token"] })
  res.json({ wishlist: await toView(req.scope, wishlist) })
}
