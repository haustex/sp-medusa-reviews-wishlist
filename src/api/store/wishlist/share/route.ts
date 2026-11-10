import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { noStore } from "../../../../lib/http"
import { ensureWishlist, findWishlist, setShareToken } from "../../../../lib/wishlists"

/** Create (or rotate) the read-only share token; the storefront builds the URL. DELETE revokes it. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  noStore(res)
  const { wishlist } = await ensureWishlist(req.scope, { customer_id: req.auth_context.actor_id })
  const token = await setShareToken(req.scope, wishlist, true)
  res.json({ token })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  noStore(res)
  const wishlist = await findWishlist(req.scope, { customer_id: req.auth_context.actor_id })
  if (!wishlist) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No wishlist")
  await setShareToken(req.scope, wishlist, false)
  res.json({ revoked: true })
}
