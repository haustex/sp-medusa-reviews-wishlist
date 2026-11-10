import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, FulfillmentWorkflowEvents } from "@medusajs/framework/utils"
import { orderIdOfFulfillment } from "../lib/eligibility"
import { scheduleReviewRequest } from "../lib/review-requests"

/** A fulfillment was shipped or delivered: schedule the order's review request if its rule is now satisfied. */
export default async function fulfillmentProgressHandler({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentId = event.data?.id
  if (!fulfillmentId) return
  const orderId = await orderIdOfFulfillment(container, fulfillmentId)
  if (!orderId) return
  const result = await scheduleReviewRequest(container, orderId)
  logger.debug(`[reviews] ${event.name} fulfillment ${fulfillmentId} → order ${orderId}: ${result.status}`)
}

export const config: SubscriberConfig = {
  event: [FulfillmentWorkflowEvents.SHIPMENT_CREATED, FulfillmentWorkflowEvents.DELIVERY_CREATED],
}
