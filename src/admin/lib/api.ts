import { sdk } from "./client"

export type ReviewStatus = "pending" | "approved" | "rejected"

/** `available` is false once the file was deleted (rejected review): only the record of a photo remains. */
export type AdminImage = { id: string; url: string | null; mime_type: string; size: number | null; position: number; published: boolean; available: boolean }
export type AdminReply = { id: string; body: string; author_id: string | null; author_name: string | null; created_at: string | null; updated_at: string | null }

export type AdminReview = {
  id: string
  product_id: string
  variant_id: string | null
  order_id: string
  order_item_id: string
  customer_id: string | null
  email: string | null
  display_name: string
  rating: number
  title: string | null
  body: string
  locale: string | null
  status: ReviewStatus
  verified: boolean
  source: string
  approved_at: string | null
  rejected_at: string | null
  moderated_by: string | null
  reject_reason: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  product_title: string | null
  order_display_id: number | null
  images: AdminImage[]
  reply: AdminReply | null
}

export type Rating = { product_id: string; average: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number>; last_review_at: string | null }
export type Stats = { pending: number; approved: number; rejected: number; total: number; rating?: Rating; wishlist_count?: number }

export type ReviewRequest = {
  id: string
  order_id: string
  customer_id: string | null
  email: string
  has_token: boolean
  trigger: string
  delay_days: number
  scheduled_at: string
  sent_at: string | null
  expires_at: string | null
  used_at: string | null
  status: "scheduled" | "sent" | "used" | "expired" | "skipped" | "failed" | "opted_out"
  locale: string | null
  attempts: number
  last_error: string | null
  created_at: string
}

export type Config = {
  show_credit: boolean
  auto_approve: boolean
  display_name: string
  max_photos: number
  review_requests: { enabled: boolean; trigger: string; delay_days: number; token_ttl_days: number; link_url_configured: boolean; rules: number }
  wishlist: { enabled: boolean; counts: boolean; share: boolean }
}

export type ReviewFilters = { status?: ReviewStatus; product_id?: string; order_id?: string; rating?: number; has_images?: boolean; q?: string; order?: string }

export const KEY = ["reviews-wishlist"]
export const CONFIG_KEY = [...KEY, "config"]
export const REVIEWS_KEY = [...KEY, "reviews"]
export const REQUESTS_KEY = [...KEY, "requests"]
export const STATS_KEY = [...KEY, "stats"]

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null && v !== false))

export const getConfig = () => sdk.client.fetch<Config>("/admin/reviews/config")
export const getStats = (product_id?: string) => sdk.client.fetch<Stats>("/admin/reviews/stats", { query: clean({ product_id }) })

export const listReviews = (f: ReviewFilters, offset: number, limit: number) =>
  sdk.client.fetch<{ reviews: AdminReview[]; count: number }>("/admin/reviews", { query: { ...clean(f), offset, limit } })
export const getReview = (id: string) => sdk.client.fetch<{ review: AdminReview }>(`/admin/reviews/${id}`)
export const moderateReview = (id: string, status: "approved" | "rejected", reject_reason?: string) =>
  sdk.client.fetch<{ review: AdminReview }>(`/admin/reviews/${id}`, { method: "POST", body: clean({ status, reject_reason }) })
export const deleteReview = (id: string) => sdk.client.fetch<{ deleted: boolean }>(`/admin/reviews/${id}`, { method: "DELETE" })
export const batchReviews = (body: { ids: string[]; status?: "approved" | "rejected"; delete?: boolean; reject_reason?: string }) =>
  sdk.client.fetch<{ changed?: string[]; deleted?: string[] }>("/admin/reviews/batch", { method: "POST", body: clean(body) })
export const replyReview = (id: string, body: string) => sdk.client.fetch<{ review: AdminReview }>(`/admin/reviews/${id}/reply`, { method: "POST", body: { body } })
export const deleteReply = (id: string) => sdk.client.fetch<{ review: AdminReview }>(`/admin/reviews/${id}/reply`, { method: "DELETE" })
export const refreshRatings = (product_ids: string[]) => sdk.client.fetch<{ ratings: Rating[] }>("/admin/reviews/ratings/refresh", { method: "POST", body: { product_ids } })

export const listRequests = (f: { status?: string; order_id?: string }, offset: number, limit: number) =>
  sdk.client.fetch<{ review_requests: ReviewRequest[]; count: number }>("/admin/review-requests", { query: { ...clean(f), offset, limit } })
export const sendRequest = (id: string) =>
  sdk.client.fetch<{ review_request: ReviewRequest; summary: { sent: number; failed: number; skipped: number } }>(`/admin/review-requests/${id}/send`, { method: "POST", body: {} })
export const scheduleRequest = (order_id: string, send_now: boolean) =>
  sdk.client.fetch<{ status: string; request_id?: string; summary: { sent: number; failed: number; skipped: number } | null }>("/admin/review-requests/schedule", {
    method: "POST",
    body: { order_id, send_now },
  })

export const backendUrl = (path: string) => `${(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "")}${path}`
/** Photo for moderation: pending ones are private and streamed through the Admin session. */
export const photoUrl = (reviewId: string, imageId: string) => backendUrl(`/admin/reviews/${reviewId}/images/${imageId}`)

export const lang = (l: string) => (l.startsWith("id") ? "id" : "en")
export function formatDateTime(iso: string | null | undefined, l: string) {
  if (!iso) return "–"
  return new Intl.DateTimeFormat(l === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
}
export const STATUS_COLOR: Record<string, "grey" | "blue" | "orange" | "green" | "red" | "purple"> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
  scheduled: "blue",
  sent: "purple",
  used: "green",
  expired: "grey",
  skipped: "grey",
  failed: "red",
  opted_out: "grey",
}
