import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../../../modules/reviews"
import type ReviewsModuleService from "../../../../../modules/reviews/service"
import { sendDueReviewRequests } from "../../../../../lib/review-requests"

/** Send this request now (a sent one gets a fresh link; a used/opted-out one is refused). */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const [request] = await service.listReviewRequests({ id: req.params.id }, { take: 1 })
  if (!request) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Review request ${req.params.id} not found`)
  if (!["scheduled", "sent", "failed", "expired", "skipped"].includes(request.status)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `A ${request.status} review request cannot be sent`)
  }
  await service.updateReviewRequests({ id: request.id, status: "scheduled", scheduled_at: new Date(), token_hash: null, attempts: 0 })
  const summary = await sendDueReviewRequests(req.scope, 500)
  const [updated] = await service.listReviewRequests({ id: request.id }, { take: 1 })
  const { token_hash, email_hash: _h, ...rest } = updated
  res.json({ review_request: { ...rest, has_token: !!token_hash }, summary })
}
