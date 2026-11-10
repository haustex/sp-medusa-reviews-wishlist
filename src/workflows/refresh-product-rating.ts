import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { refreshProductRatingStep } from "./steps/refresh-product-rating"
import { emitEventsStep } from "./steps/emit-events"
import { ReviewEvents } from "../lib/events"

export const refreshProductRatingWorkflowId = "refresh-product-rating"

/** Recompute the stored aggregate of products (e.g. after an import or a manual database change). */
export const refreshProductRatingWorkflow = createWorkflow(refreshProductRatingWorkflowId, (input: { product_ids: string[] }) => {
  const ratings = refreshProductRatingStep({ product_ids: input.product_ids })
  const events = transform({ ratings }, ({ ratings }) => ratings.map((r) => ({ name: ReviewEvents.RATING_UPDATED, data: { product_id: r.product_id, average: r.average, count: r.count } })))
  emitEventsStep(events)
  return new WorkflowResponse(ratings)
})
