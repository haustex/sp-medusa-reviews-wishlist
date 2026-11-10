/**
 * schema.org fragments for a product page, built only from what the Store API returns: approved reviews and the
 * stored aggregate. Nothing here invents, pads or rounds ratings up. Import from "medusa-reviews-wishlist/jsonld".
 */

export type RatingLike = { average: number; count: number }
export type ReviewLike = {
  display_name: string
  rating: number
  title?: string | null
  body: string
  locale?: string | null
  created_at: string
  /** Present on the customer's own reviews; anything but "approved" is left out. */
  status?: string
  reply?: { body: string; author_name?: string | null; created_at: string } | null
}

export type AggregateRatingJsonLd = { "@type": "AggregateRating"; ratingValue: number; reviewCount: number; bestRating: 5; worstRating: 1 }
export type ReviewJsonLd = {
  "@type": "Review"
  author: { "@type": "Person"; name: string }
  datePublished: string
  reviewRating: { "@type": "Rating"; ratingValue: number; bestRating: 5; worstRating: 1 }
  reviewBody: string
  name?: string
  inLanguage?: string
  comment?: { "@type": "Comment"; text: string; dateCreated: string; author?: { "@type": "Organization"; name: string } }
}

/** `aggregateRating` for a Product, or null when there is no approved review yet (Google rejects a 0-count rating). */
export function aggregateRating(rating: RatingLike | null | undefined): AggregateRatingJsonLd | null {
  if (!rating || !rating.count || rating.count < 1 || !(rating.average > 0)) return null
  return { "@type": "AggregateRating", ratingValue: Math.round(rating.average * 10) / 10, reviewCount: rating.count, bestRating: 5, worstRating: 1 }
}

/** One schema.org Review; null for a review that is not approved. */
export function review(r: ReviewLike, options: { storeName?: string } = {}): ReviewJsonLd | null {
  if (r.status && r.status !== "approved") return null
  if (!(r.rating >= 1 && r.rating <= 5)) return null
  const out: ReviewJsonLd = {
    "@type": "Review",
    author: { "@type": "Person", name: r.display_name },
    datePublished: r.created_at.slice(0, 10),
    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    reviewBody: r.body,
  }
  if (r.title) out.name = r.title
  if (r.locale) out.inLanguage = r.locale
  if (r.reply?.body) {
    out.comment = { "@type": "Comment", text: r.reply.body, dateCreated: r.reply.created_at.slice(0, 10) }
    if (options.storeName) out.comment.author = { "@type": "Organization", name: options.storeName }
  }
  return out
}

/**
 * The two Product properties in one go: spread the result into your Product JSON-LD
 * (`{ "@type": "Product", name, ...productReviews(rating, reviews) }`). Keys are omitted when empty, so the
 * Product stays valid without reviews.
 */
export function productReviews(rating: RatingLike | null | undefined, reviews: ReviewLike[] = [], options: { storeName?: string; limit?: number } = {}): { aggregateRating?: AggregateRatingJsonLd; review?: ReviewJsonLd[] } {
  const out: { aggregateRating?: AggregateRatingJsonLd; review?: ReviewJsonLd[] } = {}
  const agg = aggregateRating(rating)
  if (agg) out.aggregateRating = agg
  const list = reviews.map((r) => review(r, options)).filter((r): r is ReviewJsonLd => !!r)
  if (list.length) out.review = options.limit ? list.slice(0, options.limit) : list
  return out
}
