import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { deleteReviewReplyStep, upsertReviewReplyStep, type UpsertReplyInput } from "./steps/upsert-review-reply"
import { emitEventsStep } from "./steps/emit-events"
import { ReviewEvents } from "../lib/events"

export const replyReviewWorkflowId = "reply-review"

export const replyReviewWorkflow = createWorkflow(replyReviewWorkflowId, (input: UpsertReplyInput) => {
  const result = upsertReviewReplyStep(input)
  const events = transform({ input, result }, ({ input, result }) => [{ name: ReviewEvents.REPLIED, data: { id: input.review_id, product_id: result.product_id } }])
  emitEventsStep(events)
  return new WorkflowResponse(result)
})

export const deleteReviewReplyWorkflowId = "delete-review-reply"

export const deleteReviewReplyWorkflow = createWorkflow(deleteReviewReplyWorkflowId, (input: { review_id: string }) => {
  const result = deleteReviewReplyStep(input)
  const events = transform({ input, result }, ({ input, result }) => [{ name: ReviewEvents.REPLIED, data: { id: input.review_id, product_id: (result as { product_id: string }).product_id, deleted: true } }])
  emitEventsStep(events)
  return new WorkflowResponse(result)
})
