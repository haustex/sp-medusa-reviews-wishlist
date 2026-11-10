import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { limit } from "../../../../../lib/http"
import { findShared, toView } from "../../../../../lib/wishlists"

/** A shared wishlist, read-only, nothing about its owner. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  await limit(req, "store.wishlist.shared")
  const wishlist = await findShared(req.scope, req.params.token)
  if (!wishlist) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Shared wishlist not found")
  res.json({ wishlist: await toView(req.scope, wishlist) })
}
