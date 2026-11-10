/** Shapes returned by the APIs. The Store shape never carries e-mail, order, customer or IP data. */

type ImageRow = { id: string; url: string | null; mime_type: string; position: number; private_file_id?: string | null; file_id?: string | null; size?: number }
type ReplyRow = { id: string; body: string; author_name: string | null; author_id?: string | null; created_at: Date | string; updated_at?: Date | string } | null
export type ReviewRow = {
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
  status: string
  verified: boolean
  source: string
  ip_hash?: string | null
  approved_at: Date | string | null
  rejected_at: Date | string | null
  moderated_by: string | null
  reject_reason: string | null
  metadata: Record<string, unknown> | null
  created_at: Date | string
  updated_at: Date | string
  images?: ImageRow[] | null
  reply?: ReplyRow
}

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

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null)

export function toStoreReview(r: ReviewRow): StoreReview {
  return {
    id: r.id,
    product_id: r.product_id,
    variant_id: r.variant_id ?? null,
    display_name: r.display_name,
    rating: r.rating,
    title: r.title ?? null,
    body: r.body,
    locale: r.locale ?? null,
    verified: !!r.verified,
    images: (r.images ?? [])
      .filter((i) => !!i.url)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, url: i.url as string })),
    reply: r.reply ? { body: r.reply.body, author_name: r.reply.author_name ?? null, created_at: iso(r.reply.created_at) as string } : null,
    created_at: iso(r.created_at) as string,
  }
}

/** The customer's own review: Store shape plus status (so they see "awaiting moderation"). */
export function toOwnReview(r: ReviewRow) {
  return { ...toStoreReview(r), status: r.status, order_id: r.order_id, order_item_id: r.order_item_id }
}

export function toAdminReview(r: ReviewRow, extra: { product_title?: string | null; order_display_id?: number | null } = {}) {
  const { ip_hash: _ip, images, reply, ...rest } = r
  return {
    ...rest,
    product_title: extra.product_title ?? null,
    order_display_id: extra.order_display_id ?? null,
    images: (images ?? []).sort((a, b) => a.position - b.position).map((i) => ({ id: i.id, url: i.url, mime_type: i.mime_type, size: i.size ?? null, position: i.position, published: !!i.url, available: !!(i.url || i.private_file_id) })),
    reply: reply ? { id: reply.id, body: reply.body, author_id: reply.author_id ?? null, author_name: reply.author_name ?? null, created_at: iso(reply.created_at), updated_at: iso(reply.updated_at) } : null,
  }
}

export type RatingRow = { product_id: string; average: number; count: number; count_1: number; count_2: number; count_3: number; count_4: number; count_5: number; last_review_at?: Date | string | null }

export function toRating(r: RatingRow | undefined, product_id: string) {
  return {
    product_id,
    average: r ? Number(r.average) : 0,
    count: r?.count ?? 0,
    distribution: { 1: r?.count_1 ?? 0, 2: r?.count_2 ?? 0, 3: r?.count_3 ?? 0, 4: r?.count_4 ?? 0, 5: r?.count_5 ?? 0 },
    last_review_at: iso(r?.last_review_at),
  }
}
