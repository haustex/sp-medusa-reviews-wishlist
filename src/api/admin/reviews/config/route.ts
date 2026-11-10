import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOptions } from "../../../../lib/options"

/** Non-secret plugin settings the Admin pages adapt to. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const o = getOptions(req.scope)
  res.json({
    show_credit: o.showCredit,
    auto_approve: o.auto_approve,
    display_name: o.display_name,
    max_photos: o.reviews.max_photos,
    review_requests: {
      enabled: o.review_requests.enabled,
      trigger: o.review_requests.trigger,
      delay_days: o.review_requests.delay_days,
      token_ttl_days: o.review_requests.token_ttl_days,
      link_url_configured: !!o.review_requests.link_url,
      rules: o.review_requests.rules.length,
    },
    wishlist: { enabled: true, counts: o.wishlist.counts, share: o.wishlist.share },
  })
}
