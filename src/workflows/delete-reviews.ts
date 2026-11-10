import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { deleteReviewsStep } from "./steps/delete-reviews"
import { refreshProductRatingStep } from "./steps/refresh-product-rating"
import { emitEventsStep } from "./steps/emit-events"
import { ReviewEvents } from "../lib/events"

export const deleteReviewsWorkflowId = "delete-reviews"

export const deleteReviewsWorkflow = createWorkflow(deleteReviewsWorkflowId, (input: { ids: string[] }) => {
  const deleted = deleteReviewsStep(input)
  const productIds = transform({ deleted }, ({ deleted }) => [...new Set(deleted.map((d) => d.product_id))])
  const ratings = refreshProductRatingStep({ product_ids: productIds })
  const events = transform({ deleted, ratings }, ({ deleted, ratings }) => [
    ...deleted.map((d) => ({ name: ReviewEvents.DELETED, data: { id: d.id, product_id: d.product_id } })),
    ...ratings.map((r) => ({ name: ReviewEvents.RATING_UPDATED, data: { product_id: r.product_id, average: r.average, count: r.count } })),
  ])
  emitEventsStep(events)
  return new WorkflowResponse(deleted)
})
