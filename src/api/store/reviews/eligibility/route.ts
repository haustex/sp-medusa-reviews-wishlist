import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getOptions } from "../../../../lib/options"
import { noStore } from "../../../../lib/http"
import { loadOrderForReview, ruleFor } from "../../../../lib/eligibility"
import { openItems } from "../../../../lib/review-requests"

/** Which items of one of the customer's orders can be reviewed right now. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  noStore(res)
  const options = getOptions(req.scope)
  const orderId = (req.validatedQuery as { order_id: string }).order_id
  const probe = await loadOrderForReview(req.scope, orderId, options.review_requests.trigger)
  if (!probe || probe.customer_id !== req.auth_context.actor_id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  const rule = ruleFor(options.review_requests, probe)
  const order = rule.trigger === options.review_requests.trigger ? probe : await loadOrderForReview(req.scope, orderId, rule.trigger)
  const open = new Set((await openItems(req.scope, order!)).map((i) => i.order_item_id))
  res.json({
    order_id: order!.id,
    trigger: rule.trigger,
    items: order!.items.map((i) => ({ ...i, reviewable: open.has(i.order_item_id), reviewed: i.eligible && !open.has(i.order_item_id) })),
  })
}
