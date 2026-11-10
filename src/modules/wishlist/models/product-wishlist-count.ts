import { model } from "@medusajs/framework/utils"

/** How many wishlists hold a product (only kept when the `wishlist.counts` option is on). */
const ProductWishlistCount = model.define("product_wishlist_count", {
  id: model.id({ prefix: "pwlc" }).primaryKey(),
  product_id: model.text().unique(),
  count: model.number().default(0),
})

export default ProductWishlistCount
