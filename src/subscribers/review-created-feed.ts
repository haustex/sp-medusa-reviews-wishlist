import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { INotificationModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../modules/reviews"
import type ReviewsModuleService from "../modules/reviews/service"
import { ReviewEvents } from "../lib/events"
import { getOptions } from "../lib/options"

/** New review → a line in the Admin's notification bell (Notification Module channel "feed"). */
export default async function reviewCreatedFeedHandler({ event, container }: SubscriberArgs<{ id: string; product_id: string; status: string }>) {
  if (!getOptions(container).notify_admin_feed) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const [review] = await container.resolve<ReviewsModuleService>(REVIEWS_MODULE).listReviews({ id: event.data.id }, { take: 1 })
    if (!review) return
    let productTitle = review.product_id
    try {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "product", fields: ["title"], filters: { id: review.product_id } })
      productTitle = (data?.[0] as { title?: string } | undefined)?.title ?? productTitle
    } catch {
      // product gone or query unavailable: the id still identifies it
    }
    const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating)
    await container.resolve<INotificationModuleService>(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: ReviewEvents.CREATED,
      resource_id: review.id,
      resource_type: "review",
      data: {
        title: `New review ${stars} · ${productTitle}`,
        description: `${review.display_name}: ${(review.title || review.body).slice(0, 120)}${review.status === "pending" ? " — awaiting moderation" : ""}`,
      },
    })
  } catch (e) {
    // No feed provider registered, or the notification failed: never block the review
    logger.debug(`[reviews] admin feed notification skipped: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ReviewEvents.CREATED,
}
