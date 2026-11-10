/** Events emitted by the plugin (payloads carry ids only; fetch what you need). */
export const ReviewEvents = {
  CREATED: "review.created", // { id, product_id, status }
  APPROVED: "review.approved", // { id, product_id }
  REJECTED: "review.rejected", // { id, product_id }
  DELETED: "review.deleted", // { id, product_id }
  REPLIED: "review.replied", // { id, product_id }
  RATING_UPDATED: "product_rating.updated", // { product_id, average, count }
  REQUEST_SCHEDULED: "review_request.scheduled", // { id, order_id }
  REQUEST_SENT: "review_request.sent", // { id, order_id }
} as const

export const WishlistEvents = {
  ITEM_ADDED: "wishlist.item_added", // { wishlist_id, product_id, variant_id }
  ITEM_REMOVED: "wishlist.item_removed", // { wishlist_id, product_id, variant_id }
  MERGED: "wishlist.merged", // { wishlist_id, from_wishlist_id, customer_id }
} as const
