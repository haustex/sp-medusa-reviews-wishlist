import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, OrderWorkflowEvents } from "@medusajs/framework/utils"
import { scheduleReviewRequest } from "../lib/review-requests"

/** Orders completed (the workflow emits one event with an array of { id }, or a single object). */
export default async function orderCompletedHandler({ event, container }: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const entries = Array.isArray(event.data) ? event.data : [event.data]
  for (const entry of entries) {
    if (!entry?.id) continue
    const result = await scheduleReviewRequest(container, entry.id)
    logger.debug(`[reviews] order.completed ${entry.id}: ${result.status}`)
  }
}

export const config: SubscriberConfig = {
  event: OrderWorkflowEvents.COMPLETED,
}
