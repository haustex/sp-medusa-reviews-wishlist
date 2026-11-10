import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { moderateReviewsWorkflow } from "../../../../workflows/moderate-reviews"
import { deleteReviewsWorkflow } from "../../../../workflows/delete-reviews"

type Body = { ids: string[]; status?: "approved" | "rejected"; delete?: boolean; reject_reason?: string }

/** Bulk approve / reject / delete. */
export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const { ids, status, reject_reason } = req.validatedBody
  if (req.validatedBody.delete) {
    const { result } = await deleteReviewsWorkflow(req.scope).run({ input: { ids } })
    res.json({ deleted: result.map((r) => r.id) })
    return
  }
  if (!status) throw new MedusaError(MedusaError.Types.INVALID_DATA, "status or delete is required")
  const { result } = await moderateReviewsWorkflow(req.scope).run({ input: { ids, status, moderated_by: req.auth_context?.actor_id ?? null, reject_reason: reject_reason ?? null } })
  res.json({ changed: result.changed.map((c) => c.id), status })
}
