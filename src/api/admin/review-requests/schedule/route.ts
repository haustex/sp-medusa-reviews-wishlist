import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../../modules/reviews"
import type ReviewsModuleService from "../../../../modules/reviews/service"
import { scheduleReviewRequest, sendDueReviewRequests, type SendSummary } from "../../../../lib/review-requests"

/** Schedule (and optionally send right away) the review request of an order, e.g. for orders delivered before the plugin was installed. */
export const POST = async (req: AuthenticatedMedusaRequest<{ order_id: string; send_now?: boolean }>, res: MedusaResponse) => {
  const { order_id, send_now } = req.validatedBody
  const result = await scheduleReviewRequest(req.scope, order_id)
  let summary: SendSummary | null = null
  if (send_now && result.request_id) {
    const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
    const [r] = await service.listReviewRequests({ id: result.request_id }, { take: 1 })
    if (r && ["scheduled", "sent", "failed", "expired", "skipped"].includes(r.status)) {
      await service.updateReviewRequests({ id: r.id, status: "scheduled", scheduled_at: new Date(), token_hash: null, attempts: 0 })
      summary = await sendDueReviewRequests(req.scope, 500)
    }
  }
  res.json({ ...result, summary })
}
