import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IFileModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../../../../modules/reviews"
import type ReviewsModuleService from "../../../../../../modules/reviews/service"

/**
 * The photo of a review for moderation. A pending photo only exists as a private file, so it is streamed here
 * (Admin session required); a published one redirects to its public URL.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const [image] = await service.listReviewImages({ id: req.params.image_id, review_id: req.params.id }, { take: 1 })
  if (!image) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Photo not found")
  if (image.url) {
    res.redirect(302, image.url)
    return
  }
  if (!image.private_file_id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Photo no longer available")
  const files = req.scope.resolve<IFileModuleService>(Modules.FILE)
  const stream = await files.getDownloadStream(image.private_file_id)
  res.setHeader("Content-Type", image.mime_type)
  res.setHeader("Cache-Control", "private, no-store")
  res.setHeader("Content-Security-Policy", "default-src 'none'")
  stream.on("error", () => {
    if (!res.headersSent) res.status(404)
    res.end()
  })
  stream.pipe(res)
}
