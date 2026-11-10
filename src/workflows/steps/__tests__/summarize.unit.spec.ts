import { summarize } from "../refresh-product-rating"

describe("summarize", () => {
  it("average to 2 decimals, distribution, last date", () => {
    const s = summarize("prod_1", [
      { rating: 5, created_at: "2026-01-01T00:00:00Z" },
      { rating: 4, created_at: "2026-02-01T00:00:00Z" },
      { rating: 4, created_at: "2026-01-15T00:00:00Z" },
    ])
    expect(s).toMatchObject({ product_id: "prod_1", average: 4.33, count: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 } })
    expect(s.last_review_at?.toISOString()).toBe("2026-02-01T00:00:00.000Z")
  })
  it("empty → zeros", () => {
    expect(summarize("p", [])).toMatchObject({ average: 0, count: 0, last_review_at: null })
  })
  it("clamps out-of-range ratings", () => {
    expect(summarize("p", [{ rating: 9, created_at: new Date() }, { rating: 0, created_at: new Date() }]).distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 1 })
  })
})
