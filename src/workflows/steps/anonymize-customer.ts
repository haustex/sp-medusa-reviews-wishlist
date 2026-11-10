import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { REVIEWS_MODULE } from "../../modules/reviews"
import type ReviewsModuleService from "../../modules/reviews/service"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import type WishlistModuleService from "../../modules/wishlist/service"
import { deleteFilesQuietly } from "../../lib/images"
import { deleteWishlistCounts } from "../../lib/wishlists"

export type AnonymizeCustomerInput = { customer_id: string; email: string | null; mode: "anonymize" | "delete" }

/**
 * Customer deleted: review requests and the wishlist go; reviews lose every personal field (or are deleted with
 * `privacy.on_customer_deleted: "delete"`). Returns the products whose rating must be refreshed.
 */
export const anonymizeCustomerStep = createStep("anonymize-customer", async (input: AnonymizeCustomerInput, { container }) => {
  const reviews = container.resolve<ReviewsModuleService>(REVIEWS_MODULE)
  const wishlist = container.resolve<WishlistModuleService>(WISHLIST_MODULE)
  const product_ids = new Set<string>()

  const filters: Record<string, unknown>[] = [{ customer_id: input.customer_id }]
  if (input.email) filters.push({ email: input.email })
  const own = await reviews.listReviews({ $or: filters }, { relations: ["images", "reply"], take: null })
  if (input.mode === "delete") {
    for (const r of own) {
      product_ids.add(r.product_id)
      const images = r.images ?? []
      await deleteFilesQuietly(container, images.flatMap((i) => [i.private_file_id, i.file_id]))
      if (images.length) await reviews.deleteReviewImages(images.map((i) => i.id))
      if (r.reply) await reviews.deleteReviewReplies(r.reply.id)
    }
    if (own.length) await reviews.deleteReviews(own.map((r) => r.id))
  } else if (own.length) {
    await reviews.updateReviews(own.map((r) => ({ id: r.id, customer_id: null, email: null, ip_hash: null, display_name: "Customer" })))
  }

  const requestFilters: Record<string, unknown>[] = [{ customer_id: input.customer_id }]
  if (input.email) requestFilters.push({ email: input.email })
  const requests = await reviews.listReviewRequests({ $or: requestFilters }, { take: null })
  if (requests.length) await reviews.deleteReviewRequests(requests.map((r) => r.id))

  const uploads = await reviews.listReviewUploads({ owner: input.customer_id }, { take: null })
  await deleteFilesQuietly(container, uploads.map((u) => u.file_id))
  if (uploads.length) await reviews.deleteReviewUploads(uploads.map((u) => u.id))

  const lists = await wishlist.listWishlists({ customer_id: input.customer_id }, { relations: ["items"], take: null })
  for (const l of lists) {
    await deleteWishlistCounts(container, l)
    const items = l.items ?? []
    if (items.length) await wishlist.deleteWishlistItems(items.map((i) => i.id))
  }
  if (lists.length) await wishlist.deleteWishlists(lists.map((l) => l.id))
  const removedProducts = lists.flatMap((l) => (l.items ?? []).map((i) => i.product_id))

  return new StepResponse({ product_ids: [...product_ids], removed_wishlist_products: removedProducts, reviews: own.length, wishlists: lists.length })
})
