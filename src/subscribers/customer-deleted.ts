import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, CustomerWorkflowEvents } from "@medusajs/framework/utils"
import { anonymizeCustomerWorkflow } from "../workflows/anonymize-customer"
import { getOptions } from "../lib/options"

/** Privacy: a deleted customer leaves no review request, wishlist or personal field in reviews behind. */
export default async function customerDeletedHandler({ event, container }: SubscriberArgs<{ id: string; email?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const id = event.data?.id
  if (!id) return
  const { result } = await anonymizeCustomerWorkflow(container).run({
    input: { customer_id: id, email: event.data.email ?? null, mode: getOptions(container).privacy.on_customer_deleted },
  })
  logger.info(`[reviews] customer ${id} deleted: ${result.reviews} review(s) ${getOptions(container).privacy.on_customer_deleted}d, ${result.wishlists} wishlist(s) removed`)
}

export const config: SubscriberConfig = {
  event: CustomerWorkflowEvents.DELETED,
}
