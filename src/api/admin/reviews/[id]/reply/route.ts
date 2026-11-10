import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sanitizeText } from "../../../../../lib/text"
import { deleteReviewReplyWorkflow, replyReviewWorkflow } from "../../../../../workflows/reply-review"
import { REVIEWS_MODULE } from "../../../../../modules/reviews"
import type ReviewsModuleService from "../../../../../modules/reviews/service"
import { toAdminReview } from "../../../../../lib/serialize"

async function authorName(req: AuthenticatedMedusaRequest): Promise<string | null> {
  const id = req.auth_context?.actor_id
  if (!id) return null
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "user", fields: ["first_name", "last_name", "email"], filters: { id } })
    const u = data?.[0] as { first_name?: string; last_name?: string; email?: string } | undefined
    return [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || null
  } catch {
    return null
  }
}

async function reload(req: AuthenticatedMedusaRequest) {
  const [review] = await req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE).listReviews({ id: req.params.id }, { relations: ["images", "reply"], take: 1 })
  return review ? toAdminReview(review) : null
}

/** Create or replace the store's public reply. */
export const POST = async (req: AuthenticatedMedusaRequest<{ body: string }>, res: MedusaResponse) => {
  const body = sanitizeText(req.validatedBody.body, 5000)
  await replyReviewWorkflow(req.scope).run({ input: { review_id: req.params.id, body, author_id: req.auth_context?.actor_id ?? null, author_name: await authorName(req) } })
  res.json({ review: await reload(req) })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  await deleteReviewReplyWorkflow(req.scope).run({ input: { review_id: req.params.id } })
  res.json({ review: await reload(req) })
}
