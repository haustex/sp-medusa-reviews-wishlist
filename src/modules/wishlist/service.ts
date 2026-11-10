import { MedusaService } from "@medusajs/framework/utils"
import { ProductWishlistCount, Wishlist, WishlistItem } from "./models"

class WishlistModuleService extends MedusaService({
  Wishlist,
  WishlistItem,
  ProductWishlistCount,
}) {}

export default WishlistModuleService
