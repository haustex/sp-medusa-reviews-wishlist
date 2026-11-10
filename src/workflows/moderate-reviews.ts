import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { setReviewStatusStep, type SetReviewStatusInput } from "./steps/set-review-status"
import { refreshProductRatingStep } from "./steps/refresh-product-rating"
import { emitEventsStep } from "./steps/emit-events"
import { ReviewEvents } from "../lib/events"

export const moderateReviewsWorkflowId = "moderate-reviews"

/** Approve or reject reviews, publish/delete their photos, refresh the product ratings and emit the events. */
export const moderateReviewsWorkflow = createWorkflow(moderateReviewsWorkflowId, (input: SetReviewStatusInput) => {
  const result = setReviewStatusStep(input)
  const ratings = refreshProductRatingStep({ product_ids: result.product_ids })
  const events = transform({ input, result, ratings }, ({ input, result, ratings }) => [
    ...result.changed.map((c) => ({ name: input.status === "approved" ? ReviewEvents.APPROVED : ReviewEvents.REJECTED, data: { id: c.id, product_id: c.product_id } })),
    ...ratings.map((r) => ({ name: ReviewEvents.RATING_UPDATED, data: { product_id: r.product_id, average: r.average, count: r.count } })),
  ])
  emitEventsStep(events)
  return new WorkflowResponse(result)
})
