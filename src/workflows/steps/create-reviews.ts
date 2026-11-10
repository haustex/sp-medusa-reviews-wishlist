import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { REVIEWS_MODULE } from "../../modules/reviews"
import type ReviewsModuleService from "../../modules/reviews/service"
import { deleteFilesQuietly } from "../../lib/images"

export type CreateReviewInput = {
  product_id: string
  variant_id: string | null
  order_id: string
  order_item_id: string
  customer_id: string | null
  email: string | null
  display_name: string
  rating: number
  title: string | null
  body: string
  locale: string | null
  ip_hash: string | null
  /** ReviewUpload ids (already checked to belong to the requester) */
  upload_ids: string[]
  metadata?: Record<string, unknown> | null
}

export const createReviewsStep = createStep(
  "create-reviews",
  async ({ reviews: input }: { reviews: CreateReviewInput[] }, { container }) => {
    const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
    const reviews = await service.createReviews(
      input.map(({ upload_ids: _u, ...r }) => ({ ...r, status: "pending" as const, verified: true, source: "store" }))
    )
    const uploadIds = input.flatMap((r) => r.upload_ids)
    const uploads = uploadIds.length ? await service.listReviewUploads({ id: uploadIds }) : []
    const byId = new Map(uploads.map((u) => [u.id, u]))
    const images = input.flatMap((r, i) =>
      r.upload_ids
        .map((id) => byId.get(id))
        .filter((u): u is NonNullable<typeof u> => !!u)
        .map((u, position) => ({ review_id: reviews[i].id, private_file_id: u.file_id, file_id: null, url: null, mime_type: u.mime_type, size: u.size, position }))
    )
    if (images.length) await service.createReviewImages(images)
    if (uploads.length) await service.deleteReviewUploads(uploads.map((u) => u.id))
    return new StepResponse(
      reviews.map((r) => r.id),
      { review_ids: reviews.map((r) => r.id), file_ids: images.map((i) => i.private_file_id) }
    )
  },
  async (data, { container }) => {
    if (!data) return
    const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
    const images = await service.listReviewImages({ review_id: data.review_ids })
    if (images.length) await service.deleteReviewImages(images.map((i) => i.id))
    await service.deleteReviews(data.review_ids)
    await deleteFilesQuietly(container, data.file_ids)
  }
)
