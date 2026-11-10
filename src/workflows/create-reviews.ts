import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createReviewsStep, type CreateReviewInput } from "./steps/create-reviews"
import { setReviewStatusStep } from "./steps/set-review-status"
import { refreshProductRatingStep } from "./steps/refresh-product-rating"
import { emitEventsStep } from "./steps/emit-events"
import { ReviewEvents } from "../lib/events"

export type CreateReviewsWorkflowInput = { reviews: CreateReviewInput[]; auto_approve: boolean }

export const createReviewsWorkflowId = "create-reviews"

/** Creates reviews (pending, or approved when the store auto-approves) and emits review.created (+ review.approved). */
export const createReviewsWorkflow = createWorkflow(createReviewsWorkflowId, (input: CreateReviewsWorkflowInput) => {
  const ids = createReviewsStep(input)

  when(input, (i) => i.auto_approve).then(() => {
    const result = setReviewStatusStep({ ids, status: "approved", moderated_by: null })
    refreshProductRatingStep({ product_ids: result.product_ids })
  })

  const events = transform({ input, ids }, ({ input, ids }) =>
    ids.flatMap((id, i) => [
      { name: ReviewEvents.CREATED, data: { id, product_id: input.reviews[i].product_id, order_id: input.reviews[i].order_id, status: input.auto_approve ? "approved" : "pending" } },
      ...(input.auto_approve ? [{ name: ReviewEvents.APPROVED, data: { id, product_id: input.reviews[i].product_id } }] : []),
    ])
  )
  emitEventsStep(events)
  return new WorkflowResponse(ids)
})
