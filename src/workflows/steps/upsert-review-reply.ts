import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../modules/reviews"
import type ReviewsModuleService from "../../modules/reviews/service"

export type UpsertReplyInput = { review_id: string; body: string; author_id: string | null; author_name: string | null }

type Previous = { id: string; body: string; author_id: string | null; author_name: string | null }
type Undo = { created?: string; previous?: Previous }

export const upsertReviewReplyStep = createStep(
  "upsert-review-reply",
  async (input: UpsertReplyInput, { container }) => {
    const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
    const [review] = await service.listReviews({ id: input.review_id }, { relations: ["reply"] })
    if (!review) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Review ${input.review_id} not found`)
    if (review.reply) {
      const previous: Previous = { id: review.reply.id, body: review.reply.body, author_id: review.reply.author_id, author_name: review.reply.author_name }
      await service.updateReviewReplies({ id: review.reply.id, body: input.body, author_id: input.author_id, author_name: input.author_name })
      return new StepResponse({ reply_id: review.reply.id, product_id: review.product_id }, { previous } as Undo)
    }
    const reply = await service.createReviewReplies({ review_id: review.id, body: input.body, author_id: input.author_id, author_name: input.author_name })
    return new StepResponse({ reply_id: reply.id, product_id: review.product_id }, { created: reply.id } as Undo)
  },
  async (data: Undo | undefined, { container }) => {
    if (!data) return
    const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
    if (data.created) await service.deleteReviewReplies(data.created)
    else if (data.previous) await service.updateReviewReplies(data.previous)
  }
)

export const deleteReviewReplyStep = createStep("delete-review-reply", async (input: { review_id: string }, { container }) => {
  const review_id = input.review_id
  const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const [review] = await service.listReviews({ id: review_id }, { relations: ["reply"] })
  if (!review) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Review ${review_id} not found`)
  if (review.reply) await service.deleteReviewReplies(review.reply.id)
  return new StepResponse({ product_id: review.product_id })
})
