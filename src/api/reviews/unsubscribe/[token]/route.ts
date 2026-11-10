import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../../modules/reviews"
import type ReviewsModuleService from "../../../../modules/reviews/service"
import { getOptions } from "../../../../lib/options"
import { limit, noStore } from "../../../../lib/http"
import { optOut, UNSUBSCRIBE_PURPOSE } from "../../../../lib/review-requests"
import { verifySignedId } from "../../../../lib/tokens"

const page = (title: string, text: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#111}</style></head><body><h1>${title}</h1><p>${text}</p></body></html>`

/**
 * One-click unsubscribe from review-request e-mails (the link in every e-mail; valid for the lifetime of the
 * request record, no login, no publishable key). GET shows a confirmation page, POST answers JSON — both opt out.
 */
async function handle(req: MedusaRequest, res: MedusaResponse) {
  noStore(res)
  await limit(req, "reviews.unsubscribe")
  const options = getOptions(req.scope)
  const id = verifySignedId(String(req.params.token ?? ""), UNSUBSCRIBE_PURPOSE, options.secret)
  const service = req.scope.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const [request] = id ? await service.listReviewRequests({ id }, { take: 1 }) : []
  const ok = !!request
  if (ok) await optOut(req.scope, request.email, "link")
  const wantsJson = req.method === "POST" || (req.headers.accept ?? "").includes("application/json")
  if (wantsJson) {
    res.status(ok ? 200 : 404).json(ok ? { unsubscribed: true } : { unsubscribed: false, message: "Unknown unsubscribe link" })
    return
  }
  res.status(ok ? 200 : 404).type("html").send(ok ? page("Unsubscribed", "You will not receive further review requests from this store. / Anda tidak akan menerima permintaan ulasan lagi dari toko ini.") : page("Unknown link", "This unsubscribe link is not valid."))
}

export const GET = handle
export const POST = handle
