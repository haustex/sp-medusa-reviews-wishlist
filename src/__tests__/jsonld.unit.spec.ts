import { aggregateRating, productReviews, review } from "../jsonld"

const approved = { display_name: "Anto R.", rating: 5, title: "Mantap", body: "Halus.", locale: "id-ID", created_at: "2026-11-10T06:09:00.000Z", reply: { body: "Terima kasih", created_at: "2026-11-11T00:00:00.000Z" } }

describe("jsonld", () => {
  it("omits the aggregate without approved reviews", () => {
    expect(aggregateRating({ average: 0, count: 0 })).toBeNull()
    expect(aggregateRating(null)).toBeNull()
    expect(aggregateRating({ average: 4.26, count: 3 })).toEqual({ "@type": "AggregateRating", ratingValue: 4.3, reviewCount: 3, bestRating: 5, worstRating: 1 })
  })
  it("maps a review with title, language and the store's reply", () => {
    expect(review(approved, { storeName: "Haus Kayu" })).toEqual({
      "@type": "Review",
      author: { "@type": "Person", name: "Anto R." },
      datePublished: "2026-11-10",
      reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 },
      reviewBody: "Halus.",
      name: "Mantap",
      inLanguage: "id-ID",
      comment: { "@type": "Comment", text: "Terima kasih", dateCreated: "2026-11-11", author: { "@type": "Organization", name: "Haus Kayu" } },
    })
  })
  it("drops anything not approved or out of range", () => {
    expect(review({ ...approved, status: "pending" })).toBeNull()
    expect(review({ ...approved, rating: 7 })).toBeNull()
    expect(review({ ...approved, status: "approved" })).not.toBeNull()
  })
  it("builds the product fragment, empty when nothing is approved", () => {
    expect(productReviews({ average: 0, count: 0 }, [{ ...approved, status: "rejected" }])).toEqual({})
    const out = productReviews({ average: 5, count: 1 }, [approved, approved], { limit: 1 })
    expect(out.aggregateRating?.reviewCount).toBe(1)
    expect(out.review).toHaveLength(1)
  })
})
