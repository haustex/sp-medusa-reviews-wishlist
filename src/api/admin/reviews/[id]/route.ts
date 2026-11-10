import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../../modules/reviews"
import type ReviewsModuleService from "../../../../modules/reviews/service"
import { toAdminReview } from "../../../../lib/serialize"
import { moderateReviewsWorkflow } from "../../../../workflows/moderate-reviews"
import { deleteReviewsWorkflow } from "../../../../workflows/delete-reviews"
import { decorate } from "../route"

async function load(req: AuthenticatedMedusaRequest, id: string) {
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const [review] = await service.listReviews({ id }, { relations: ["images", "reply"], take: 1 })
  if (!review) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Review ${id} not found`)
  const { titles, displayIds } = await decorate(req, [review])
  return toAdminReview(review, { product_title: titles.get(review.product_id) ?? null, order_display_id: displayIds.get(review.order_id) ?? null })
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ review: await load(req, req.params.id) })
}

/** Approve or reject. Approving publishes the photos; rejecting deletes them. */
export const POST = async (req: AuthenticatedMedusaRequest<{ status: "approved" | "rejected"; reject_reason?: string }>, res: MedusaResponse) => {
  const { status, reject_reason } = req.validatedBody
  await moderateReviewsWorkflow(req.scope).run({ input: { ids: [req.params.id], status, moderated_by: req.auth_context?.actor_id ?? null, reject_reason: reject_reason ?? null } })
  res.json({ review: await load(req, req.params.id) })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  await load(req, req.params.id)
  await deleteReviewsWorkflow(req.scope).run({ input: { ids: [req.params.id] } })
  res.json({ id: req.params.id, object: "review", deleted: true })
}
