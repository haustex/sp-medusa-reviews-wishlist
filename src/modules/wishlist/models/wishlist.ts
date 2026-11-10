import { model } from "@medusajs/framework/utils"
import WishlistItem from "./wishlist-item"

/** One wishlist per customer, or a guest wishlist identified by a token (hash stored) until it is merged. */
const Wishlist = model
  .define("wishlist", {
    id: model.id({ prefix: "wl" }).primaryKey(),
    customer_id: model.text().unique().nullable(),
    guest_token_hash: model.text().unique().nullable(),
    share_token_hash: model.text().unique().nullable(),
    name: model.text().nullable(),
    metadata: model.json().nullable(),
    items: model.hasMany(() => WishlistItem, { mappedBy: "wishlist" }),
  })

export default Wishlist
