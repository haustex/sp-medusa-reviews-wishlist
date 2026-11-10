import { z } from "@medusajs/framework/zod"

const id = z.string().min(1).max(64)
const ids = z.array(id).min(1).max(100)

export const StoreCreateReviews = z.object({
  order_id: id.optional(),
  request_token: z.string().min(32).max(64).optional(),
  locale: z.string().max(35).optional(),
  reviews: z
    .array(
      z.object({
        order_item_id: id,
        rating: z.number().int().min(1).max(5),
        title: z.string().max(500).optional(),
        body: z.string().max(20_000),
        upload_ids: z.array(id).max(20).optional(),
        display_name: z.string().max(80).optional(),
      })
    )
    .min(1)
    .max(50),
}).passthrough() // the honeypot field may be present (checked in the route)
export type StoreCreateReviewsType = z.infer<typeof StoreCreateReviews>

export const StoreListReviews = z.object({
  product_id: z.union([id, z.array(id).max(50)]),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  order: z.enum(["newest", "oldest", "highest", "lowest"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  with_images: z.coerce.boolean().optional(),
})
export type StoreListReviewsType = z.infer<typeof StoreListReviews>

export const StoreRatings = z.object({ product_id: z.union([id, z.array(id).max(100)]) })

export const StoreEligibility = z.object({ order_id: id })

export const AdminListReviews = z.object({
  status: z.union([z.enum(["pending", "approved", "rejected"]), z.array(z.enum(["pending", "approved", "rejected"]))]).optional(),
  product_id: z.union([id, z.array(id)]).optional(),
  order_id: id.optional(),
  customer_id: id.optional(),
  rating: z.union([z.coerce.number().int().min(1).max(5), z.array(z.coerce.number().int().min(1).max(5))]).optional(),
  verified: z.coerce.boolean().optional(),
  has_images: z.coerce.boolean().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  order: z.string().max(40).optional(),
})
export type AdminListReviewsType = z.infer<typeof AdminListReviews>

export const AdminUpdateReview = z.object({
  status: z.enum(["approved", "rejected"]),
  reject_reason: z.string().max(500).optional(),
})
export const AdminBatchReviews = z.object({
  ids,
  status: z.enum(["approved", "rejected"]).optional(),
  delete: z.boolean().optional(),
  reject_reason: z.string().max(500).optional(),
})
export const AdminReply = z.object({ body: z.string().min(1).max(5000) })
export const AdminRefreshRatings = z.object({ product_ids: z.array(id).min(1).max(500) })

export const AdminListReviewRequests = z.object({
  status: z.union([z.string().max(20), z.array(z.string().max(20))]).optional(),
  order_id: id.optional(),
  customer_id: id.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
export const AdminScheduleReviewRequest = z.object({ order_id: id, send_now: z.boolean().optional() })

export const StoreWishlistAddItem = z.object({ product_id: id, variant_id: id.nullable().optional() })
export const StoreWishlistMerge = z.object({ token: z.string().min(32).max(64) })
export const StoreWishlistCounts = z.object({ product_id: z.union([id, z.array(id).max(100)]) })
