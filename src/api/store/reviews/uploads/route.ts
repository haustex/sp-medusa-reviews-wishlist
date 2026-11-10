import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../../modules/reviews"
import type ReviewsModuleService from "../../../../modules/reviews/service"
import { getOptions } from "../../../../lib/options"
import { limit, noStore } from "../../../../lib/http"
import { sniffImageType, storePrivateImage } from "../../../../lib/images"
import { resolveRequestToken } from "../../../../lib/review-requests"
import { isValidTokenShape } from "../../../../lib/tokens"

type Uploaded = { originalname: string; mimetype: string; size: number; buffer: Buffer }

/**
 * Photos for a review that is about to be written: stored as private files (no public URL until the review is
 * approved). Needs a customer login or the magic-link token in `x-review-token`. Returns upload ids to pass to
 * POST /store/reviews. Unused uploads are deleted after 24 h.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  noStore(res)
  await limit(req, "store.reviews.upload")
  const options = getOptions(req.scope)
  if (options.reviews.max_photos <= 0) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Review photos are disabled")

  let owner = req.auth_context?.actor_id ?? null
  if (!owner) {
    const token = req.headers["x-review-token"]
    if (!isValidTokenShape(token)) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Log in or send the review link token in x-review-token")
    const ctx = await resolveRequestToken(req.scope, token)
    owner = `req:${ctx.request.id}`
  }

  const files = ((req as unknown as { files?: Uploaded[] }).files ?? []) as Uploaded[]
  if (!files.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "No files uploaded (field name: files)")
  if (files.length > options.reviews.max_photos) throw new MedusaError(MedusaError.Types.INVALID_DATA, `At most ${options.reviews.max_photos} photo(s)`)

  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const uploads: { id: string; mime_type: string; size: number }[] = []
  for (const f of files) {
    if (f.size > options.reviews.max_photo_bytes) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${f.originalname}: larger than ${Math.round(options.reviews.max_photo_bytes / 1024 / 1024)} MB`)
    const mime = sniffImageType(f.buffer.subarray(0, 16))
    if (!mime || !options.reviews.photo_types.includes(mime)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${f.originalname}: not an accepted image (${options.reviews.photo_types.join(", ")})`)
    const file_id = await storePrivateImage(req.scope, f.buffer, mime)
    const row = await service.createReviewUploads({ owner, file_id, mime_type: mime, size: f.size })
    uploads.push({ id: row.id, mime_type: mime, size: f.size })
  }
  res.status(201).json({ uploads })
}
