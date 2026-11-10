import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOptions } from "../lib/options"
import { sendDueReviewRequests } from "../lib/review-requests"

/** Every 15 minutes: send the review-request e-mails that are due and expire old magic links. */
export default async function sendReviewRequestsJob(container: MedusaContainer) {
  const options = getOptions(container)
  const summary = await sendDueReviewRequests(container, options.review_requests.batch_size)
  if (summary.sent || summary.failed || summary.skipped || summary.expired) {
    container.resolve(ContainerRegistrationKeys.LOGGER).info(`[reviews] review requests: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed, ${summary.expired} link(s) expired`)
  }
}

export const config = {
  name: "reviews-send-review-requests",
  schedule: "*/15 * * * *",
}
