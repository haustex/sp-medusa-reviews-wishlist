/**
 * Typed helpers over `@medusajs/js-sdk` for the plugin's Store and Admin endpoints. Import from
 * "medusa-reviews-wishlist/sdk":
 *
 *   import Medusa from "@medusajs/js-sdk"
 *   import { reviewsStore, wishlistStore } from "medusa-reviews-wishlist/sdk"
 *   const sdk = new Medusa({ baseUrl, publishableKey })
 *   const { ratings } = await reviewsStore(sdk).ratings([productId])
 *
 * Only `sdk.client.fetch` is used, so any object with that shape works (your own fetch wrapper included).
 */

export type FetchClient = { client: { fetch: <T>(path: string, init?: { method?: string; body?: unknown; query?: Record<string, unknown>; headers?: Record<string, string> }) => Promise<T> } }

export type StoreReview = {
  id: string
  product_id: string
  variant_id: string | null
  display_name: string
  rating: number
  title: string | null
  body: string
  locale: string | null
  verified: boolean
  images: { id: string; url: string }[]
  reply: { body: string; author_name: string | null; created_at: string } | null
  created_at: string
}
export type OwnReview = StoreReview & { status: "pending" | "approved" | "rejected"; order_id: string; order_item_id: string }
export type Rating = { product_id: string; average: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number>; last_review_at: string | null }
export type ReviewableItem = {
  order_item_id: string
  product_id: string
  variant_id: string | null
  title: string
  product_title: string | null
  thumbnail: string | null
  quantity: number
  state: "none" | "shipped" | "delivered" | "completed"
  eligible: boolean
}
export type EligibilityItem = ReviewableItem & { reviewable: boolean; reviewed: boolean }
export type ReviewInput = { order_item_id: string; rating: 1 | 2 | 3 | 4 | 5; title?: string; body: string; upload_ids?: string[]; display_name?: string }
export type CreateReviewsBody = { order_id?: string; request_token?: string; locale?: string; reviews: ReviewInput[] } & Record<string, unknown>
export type ListReviewsQuery = { product_id: string | string[]; limit?: number; offset?: number; order?: "newest" | "oldest" | "highest" | "lowest"; rating?: number; with_images?: boolean }
export type RequestInfo = {
  order: { id: string; display_id: number | null; email: string; first_name: string | null; created_at: string | null }
  items: ReviewableItem[]
  /** Items of the order still without a review, shipped or not: the link stays valid while this is > 0. */
  remaining_items: number
  expires_at: string | null
}

export type WishlistItem = {
  id: string
  product_id: string
  variant_id: string | null
  created_at: string
  product: { id: string; title: string; handle: string | null; thumbnail: string | null } | null
  variant: { id: string; title: string | null } | null
}
export type Wishlist = { id: string; name: string | null; items: WishlistItem[]; created_at: string; updated_at: string }

const guest = (token?: string | null) => (token ? { headers: { "x-wishlist-token": token } } : {})

/** Store API: ratings, review lists, eligibility, creating reviews (logged in or with a magic link). */
export function reviewsStore(sdk: FetchClient) {
  const f = sdk.client.fetch
  return {
    /** Stored aggregates for up to 100 products: average, count, 1–5 distribution. Cacheable. */
    ratings: (product_id: string | string[]) => f<{ ratings: Rating[] }>("/store/reviews/ratings", { query: { product_id } }),
    /** Approved reviews of a product (or several), newest first by default. Cacheable. */
    list: (query: ListReviewsQuery) => f<{ reviews: StoreReview[]; count: number; limit: number; offset: number }>("/store/reviews", { query }),
    /** Which items of the logged-in customer's order can be reviewed now. */
    eligibility: (order_id: string) => f<{ order_id: string; trigger: string; items: EligibilityItem[] }>("/store/reviews/eligibility", { query: { order_id } }),
    /** The logged-in customer's own reviews, every status. */
    mine: () => f<{ reviews: OwnReview[] }>("/store/customers/me/reviews"),
    /** What a magic link may review. Opening it never consumes it. */
    request: (token: string) => f<RequestInfo>(`/store/reviews/requests/${encodeURIComponent(token)}`),
    /**
     * Create one review per order item. Send photos first with `uploadPhotos` and pass their ids. The honeypot
     * field (default `website`) must be absent or empty.
     */
    create: (body: CreateReviewsBody) => f<{ reviews: (StoreReview & { status: string; order_item_id: string })[] }>("/store/reviews", { method: "POST", body }),
    /**
     * Upload photos (multipart field `files`) for a review that is about to be created; returns upload ids valid
     * for 24 h. Pass `requestToken` for a guest with a magic link. Uses `fetch` directly: the SDK has no multipart.
     */
    uploadPhotos: async (baseUrl: string, files: File[] | Blob[], opts: { publishableKey: string; customerToken?: string; requestToken?: string; credentials?: RequestCredentials } = { publishableKey: "" }) => {
      const form = new FormData()
      for (const file of files) form.append("files", file)
      const headers: Record<string, string> = { "x-publishable-api-key": opts.publishableKey }
      if (opts.customerToken) headers.authorization = `Bearer ${opts.customerToken}`
      if (opts.requestToken) headers["x-review-token"] = opts.requestToken
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/store/reviews/uploads`, { method: "POST", body: form, headers, credentials: opts.credentials ?? "include" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? `Upload failed (${res.status})`)
      return (await res.json()) as { uploads: { id: string; mime_type: string; size: number }[] }
    },
  }
}

/**
 * Store API: the customer's wishlist or a guest one. A guest gets a `token` back from the first `add`; keep it
 * (cookie / localStorage) and pass it to every call. After login call `merge(token)` once.
 */
export function wishlistStore(sdk: FetchClient) {
  const f = sdk.client.fetch
  return {
    get: (token?: string | null) => f<{ wishlist: Wishlist | null }>("/store/wishlist", guest(token)),
    add: (product_id: string, variant_id?: string | null, token?: string | null) => f<{ wishlist: Wishlist; token?: string }>("/store/wishlist/items", { method: "POST", body: { product_id, variant_id: variant_id ?? null }, ...guest(token) }),
    remove: (item_id: string, token?: string | null) => f<{ wishlist: Wishlist | null }>(`/store/wishlist/items/${item_id}`, { method: "DELETE", ...guest(token) }),
    merge: (token: string) => f<{ wishlist: Wishlist }>("/store/wishlist/merge", { method: "POST", body: { token } }),
    share: () => f<{ token: string }>("/store/wishlist/share", { method: "POST", body: {} }),
    unshare: () => f<{ revoked: boolean }>("/store/wishlist/share", { method: "DELETE" }),
    shared: (token: string) => f<{ wishlist: Wishlist }>(`/store/wishlists/shared/${encodeURIComponent(token)}`),
    /** "Saved by N people" (needs `wishlist.counts: true` in the plugin options; otherwise zeros). */
    counts: (product_id: string | string[]) => f<{ counts: Record<string, number> }>("/store/wishlist/counts", { query: { product_id } }),
  }
}

export type AdminReview = OwnReview & {
  customer_id: string | null
  email: string | null
  source: string
  approved_at: string | null
  rejected_at: string | null
  moderated_by: string | null
  reject_reason: string | null
  metadata: Record<string, unknown> | null
  updated_at: string
  product_title: string | null
  order_display_id: number | null
  images: { id: string; url: string | null; mime_type: string; size: number | null; position: number; published: boolean; available: boolean }[]
}
export type AdminListQuery = { status?: string | string[]; product_id?: string | string[]; order_id?: string; customer_id?: string; rating?: number | number[]; verified?: boolean; has_images?: boolean; q?: string; limit?: number; offset?: number; order?: string }

/** Admin API: moderation, replies, aggregates, review requests. */
export function reviewsAdmin(sdk: FetchClient) {
  const f = sdk.client.fetch
  return {
    list: (query: AdminListQuery = {}) => f<{ reviews: AdminReview[]; count: number; limit: number; offset: number }>("/admin/reviews", { query }),
    get: (id: string) => f<{ review: AdminReview }>(`/admin/reviews/${id}`),
    moderate: (id: string, status: "approved" | "rejected", reject_reason?: string) => f<{ review: AdminReview }>(`/admin/reviews/${id}`, { method: "POST", body: { status, ...(reject_reason ? { reject_reason } : {}) } }),
    remove: (id: string) => f<{ id: string; deleted: boolean }>(`/admin/reviews/${id}`, { method: "DELETE" }),
    batch: (body: { ids: string[]; status?: "approved" | "rejected"; delete?: boolean; reject_reason?: string }) => f<{ changed?: string[]; deleted?: string[] }>("/admin/reviews/batch", { method: "POST", body }),
    reply: (id: string, body: string) => f<{ review: AdminReview }>(`/admin/reviews/${id}/reply`, { method: "POST", body: { body } }),
    deleteReply: (id: string) => f<{ review: AdminReview }>(`/admin/reviews/${id}/reply`, { method: "DELETE" }),
    stats: (product_id?: string) => f<{ pending: number; approved: number; rejected: number; total: number; rating?: Rating; wishlist_count?: number }>("/admin/reviews/stats", { query: product_id ? { product_id } : {} }),
    refreshRatings: (product_ids: string[]) => f<{ ratings: Rating[] }>("/admin/reviews/ratings/refresh", { method: "POST", body: { product_ids } }),
    requests: (query: { status?: string | string[]; order_id?: string; customer_id?: string; limit?: number; offset?: number } = {}) => f<{ review_requests: Record<string, unknown>[]; count: number }>("/admin/review-requests", { query }),
    sendRequest: (id: string) => f<{ review_request: Record<string, unknown>; summary: { sent: number; failed: number; skipped: number } }>(`/admin/review-requests/${id}/send`, { method: "POST", body: {} }),
    scheduleRequest: (order_id: string, send_now = false) => f<{ status: string; request_id?: string; summary: { sent: number; failed: number; skipped: number } | null }>("/admin/review-requests/schedule", { method: "POST", body: { order_id, send_now } }),
  }
}
