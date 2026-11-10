import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { REVIEWS_MODULE } from "../../modules/reviews"
import type ReviewsModuleService from "../../modules/reviews/service"

export type RatingSummary = { product_id: string; average: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number>; last_review_at: Date | null }

export function summarize(product_id: string, ratings: { rating: number; created_at: Date | string }[]): RatingSummary {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
  let sum = 0
  let last: Date | null = null
  for (const r of ratings) {
    const v = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
    distribution[v]++
    sum += v
    const d = new Date(r.created_at)
    if (!last || d > last) last = d
  }
  const count = ratings.length
  return { product_id, average: count ? Math.round((sum / count) * 100) / 100 : 0, count, distribution, last_review_at: last }
}

/** Recomputes the stored aggregate of each product from its approved reviews (idempotent, no compensation needed). */
export const refreshProductRatingStep = createStep("refresh-product-rating", async (input: { product_ids: string[] }, { container }) => {
  const product_ids = input.product_ids
  const service = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const out: RatingSummary[] = []
  for (const product_id of [...new Set(product_ids)]) {
    const approved = await service.listReviews({ product_id, status: "approved" }, { select: ["rating", "created_at"], take: null })
    const s = summarize(product_id, approved)
    const existing = await service.listProductRatings({ product_id }, { take: 1 })
    const row = {
      product_id,
      average: s.average,
      count: s.count,
      count_1: s.distribution[1],
      count_2: s.distribution[2],
      count_3: s.distribution[3],
      count_4: s.distribution[4],
      count_5: s.distribution[5],
      last_review_at: s.last_review_at,
    }
    if (existing[0]) await service.updateProductRatings({ id: existing[0].id, ...row })
    else await service.createProductRatings(row)
    out.push(s)
  }
  return new StepResponse(out)
})
