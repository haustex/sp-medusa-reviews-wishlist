import { model } from "@medusajs/framework/utils"
import Wishlist from "./wishlist"

const WishlistItem = model
  .define("wishlist_item", {
    id: model.id({ prefix: "wli" }).primaryKey(),
    wishlist: model.belongsTo(() => Wishlist, { mappedBy: "items" }),
    product_id: model.text(),
    variant_id: model.text().nullable(),
    /** `${product_id}:${variant_id ?? ""}` — unique per wishlist (NULLs would not be). */
    item_key: model.text(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ["wishlist_id", "item_key"], unique: true }, { on: ["product_id"] }])

export default WishlistItem
