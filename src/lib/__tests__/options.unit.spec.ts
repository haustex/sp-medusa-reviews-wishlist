import { DEFAULT_PHOTO_TYPES, isThisPackage, resolveOptions } from "../options"

describe("resolveOptions", () => {
  it("applies defaults", () => {
    const o = resolveOptions(undefined, "jwt")
    expect(o.auto_approve).toBe(false)
    expect(o.display_name).toBe("short")
    expect(o.reviews).toMatchObject({ min_body_length: 10, max_body_length: 2000, max_photos: 3, photo_types: DEFAULT_PHOTO_TYPES, honeypot_field: "website" })
    expect(o.review_requests).toMatchObject({ enabled: true, trigger: "delivered", delay_days: 7, token_ttl_days: 30, template: "review-request", link_url: null })
    expect(o.rate_limit).toEqual({ window_seconds: 600, max: 10 })
    expect(o.wishlist).toEqual({ guest: true, share: true, counts: false, max_items: 200 })
    expect(o.privacy).toEqual({ on_customer_deleted: "anonymize", ip_salt: "jwt" })
    expect(o.secret).toBe("jwt")
  })
  it("keeps valid overrides and drops invalid ones", () => {
    const o = resolveOptions(
      { auto_approve: true, display_name: "initials", reviews: { max_photos: 0, min_body_length: -5 }, review_requests: { trigger: "shipped", delay_days: 0, link_url: "https://shop/review/{token}" }, privacy: { on_customer_deleted: "delete" }, secret: "own" },
      "jwt"
    )
    expect(o.auto_approve).toBe(true)
    expect(o.display_name).toBe("initials")
    expect(o.reviews.max_photos).toBe(0)
    expect(o.reviews.min_body_length).toBe(10)
    expect(o.review_requests.trigger).toBe("shipped")
    expect(o.review_requests.delay_days).toBe(0)
    expect(o.privacy.on_customer_deleted).toBe("delete")
    expect(o.privacy.ip_salt).toBe("own")
  })
  it("isThisPackage", () => {
    expect(isThisPackage("medusa-reviews-wishlist")).toBe(true)
    expect(isThisPackage("medusa-reviews-wishlist/")).toBe(true)
    expect(isThisPackage("@scope/other")).toBe(false)
  })
})
