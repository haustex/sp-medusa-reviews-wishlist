import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { limit, noStore } from "../../../../lib/http"
import { addItem, ensureWishlist, findWishlist, toView } from "../../../../lib/wishlists"

/**
 * Add a product (optionally a variant). Creates the wishlist when needed; a new guest wishlist returns `token`
 * once — keep it (cookie/localStorage) and send it as `x-wishlist-token`. Adding an item already present is a no-op.
 */
export const POST = async (req: AuthenticatedMedusaRequest<{ product_id: string; variant_id?: string | null }>, res: MedusaResponse) => {
  noStore(res)
  await limit(req, "store.wishlist.add")
  const who = { customer_id: req.auth_context?.actor_id, token: req.headers["x-wishlist-token"] }
  const { wishlist, token } = await ensureWishlist(req.scope, who)
  await addItem(req.scope, wishlist, req.validatedBody.product_id, req.validatedBody.variant_id ?? null)
  const fresh = await findWishlist(req.scope, token ? { token } : who)
  res.json({ wishlist: await toView(req.scope, fresh), ...(token ? { token } : {}) })
}
