import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../modules/reviews"
import type ReviewsModuleService from "../../modules/reviews/service"
import type { ReviewStatus } from "../../modules/reviews/models/review"
import { deleteFilesQuietly, publishImage } from "../../lib/images"

export type SetReviewStatusInput = {
  ids: string[]
  status: Extract<ReviewStatus, "approved" | "rejected">
  moderated_by: string | null
  reject_reason?: string | null
}

export type SetReviewStatusResult = { changed: { id: string; product_id: string; from: ReviewStatus }[]; product_ids: string[] }

/**
 * Approve: publish the private photos (public copy, URL set, private copy deleted). Reject: delete every photo file.
 * Photos of a pending review never get a public URL.
 */
export const setReviewStatusStep = createStep(
  "set-review-status",
  async (input: SetReviewStatusInput, { container }) => {
    const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const reviews = await service.listReviews({ id: input.ids }, { relations: ["images"] })
    const changed: SetReviewStatusResult["changed"] = []
    const now = new Date()
    for (const review of reviews) {
      if (review.status === input.status) continue
      changed.push({ id: review.id, product_id: review.product_id, from: review.status })
      const images = (review.images ?? []).slice().sort((a, b) => a.position - b.position)
      if (input.status === "approved") {
        for (const img of images) {
          if (img.url || !img.private_file_id) continue
          const pub = await publishImage(container, img.private_file_id, img.mime_type)
          await service.updateReviewImages({ id: img.id, file_id: pub.id, url: pub.url, private_file_id: null })
          await deleteFilesQuietly(container, [img.private_file_id])
        }
        await service.updateReviews({ id: review.id, status: "approved", approved_at: now, rejected_at: null, reject_reason: null, moderated_by: input.moderated_by })
      } else {
        await deleteFilesQuietly(container, images.flatMap((i) => [i.private_file_id, i.file_id]))
        if (images.length) await service.updateReviewImages(images.map((i) => ({ id: i.id, file_id: null, url: null, private_file_id: null })))
        await service.updateReviews({ id: review.id, status: "rejected", rejected_at: now, approved_at: null, reject_reason: input.reject_reason ?? null, moderated_by: input.moderated_by })
      }
      logger.info(`[reviews] ${review.id} ${review.status} → ${input.status} by ${input.moderated_by ?? "system"}`)
    }
    const product_ids = [...new Set(changed.map((c) => c.product_id))]
    return new StepResponse({ changed, product_ids } as SetReviewStatusResult, changed)
  },
  async (changed, { container }) => {
    if (!changed?.length) return
    // Files cannot be restored; the status is, so a failed workflow leaves the review where it was.
    const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
    await service.updateReviews(changed.map((c) => ({ id: c.id, status: c.from })))
  }
)
