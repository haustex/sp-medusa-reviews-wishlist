import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import sendReviewRequestsJob from "medusa-reviews-wishlist/jobs/send-review-requests"
import cleanupReviewUploadsJob from "medusa-reviews-wishlist/jobs/cleanup-review-uploads"
import { sendDueReviewRequests } from "medusa-reviews-wishlist/lib/review-requests"

/** Runs the plugin's scheduled jobs on demand (cron is not waited for in tests). */
export const POST = async (req: MedusaRequest<{ job: string; now?: string }>, res: MedusaResponse) => {
  const job = req.body?.job
  if (job === "send") {
    const summary = await sendDueReviewRequests(req.scope, 100, req.body?.now ? new Date(req.body.now) : new Date())
    res.json({ ok: true, summary })
    return
  }
  if (job === "send-job") await sendReviewRequestsJob(req.scope)
  else if (job === "cleanup") await cleanupReviewUploadsJob(req.scope)
  else {
    res.status(400).json({ message: "job must be send | send-job | cleanup" })
    return
  }
  res.json({ ok: true })
}
