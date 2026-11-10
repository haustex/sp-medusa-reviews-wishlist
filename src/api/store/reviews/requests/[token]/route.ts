import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { limit, noStore } from "../../../../../lib/http"
import { resolveRequestToken, unreviewedItems } from "../../../../../lib/review-requests"
import { isValidTokenShape } from "../../../../../lib/tokens"
import { maskEmail } from "../../../../../lib/text"

/**
 * What the magic link may review right now: the order's open items. Opening the link does not consume it.
 * `remaining_items` counts every item still without a review, including ones not shipped yet. Nothing personal
 * beyond a masked e-mail and first name.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  noStore(res)
  await limit(req, "store.reviews.request")
  const token = req.params.token
  if (!isValidTokenShape(token)) throw new MedusaError(MedusaError.Types.NOT_FOUND, "This review link is invalid, used or expired")
  const { request, order, open } = await resolveRequestToken(req.scope, token)
  const remaining = await unreviewedItems(req.scope, order)
  res.json({
    order: { id: order.id, display_id: order.display_id, email: maskEmail(order.email ?? ""), first_name: order.first_name, created_at: order.created_at },
    items: open,
    remaining_items: remaining.length,
    expires_at: request.expires_at,
  })
}
