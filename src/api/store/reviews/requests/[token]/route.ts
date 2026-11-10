import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { limit, noStore } from "../../../../../lib/http"
import { resolveRequestToken } from "../../../../../lib/review-requests"
import { isValidTokenShape } from "../../../../../lib/tokens"
import { maskEmail } from "../../../../../lib/text"

/** What the magic link may review: the order's open items. Nothing personal beyond a masked e-mail and first name. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  noStore(res)
  await limit(req, "store.reviews.request")
  const token = req.params.token
  if (!isValidTokenShape(token)) throw new MedusaError(MedusaError.Types.NOT_FOUND, "This review link is invalid, used or expired")
  const { request, order, open } = await resolveRequestToken(req.scope, token)
  res.json({
    order: { id: order.id, display_id: order.display_id, email: maskEmail(order.email ?? ""), first_name: order.first_name, created_at: order.created_at },
    items: open,
    expires_at: request.expires_at,
  })
}
