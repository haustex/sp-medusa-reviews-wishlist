import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { REVIEWS_MODULE } from "../../modules/reviews"
import type ReviewsModuleService from "../../modules/reviews/service"
import { deleteFilesQuietly } from "../../lib/images"

/** Removes reviews with their photos (files included) and replies. Not compensable: run last. */
export const deleteReviewsStep = createStep("delete-reviews", async (input: { ids: string[] }, { container }) => {
  const ids = input.ids
  const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const reviews = await service.listReviews({ id: ids }, { relations: ["images", "reply"] })
  for (const r of reviews) {
    const images = r.images ?? []
    await deleteFilesQuietly(container, images.flatMap((i) => [i.private_file_id, i.file_id]))
    if (images.length) await service.deleteReviewImages(images.map((i) => i.id))
    if (r.reply) await service.deleteReviewReplies(r.reply.id)
  }
  if (reviews.length) await service.deleteReviews(reviews.map((r) => r.id))
  return new StepResponse(reviews.map((r) => ({ id: r.id, product_id: r.product_id })))
})
