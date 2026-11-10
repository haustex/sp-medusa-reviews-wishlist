import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import WishlistModule from "../modules/wishlist"

export default defineLink({ linkable: WishlistModule.linkable.wishlistItem, field: "product_id" }, ProductModule.linkable.product, { readOnly: true })
