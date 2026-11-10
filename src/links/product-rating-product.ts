import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import ReviewsModule from "../modules/reviews"

export default defineLink({ linkable: ReviewsModule.linkable.productRating, field: "product_id" }, ProductModule.linkable.product, { readOnly: true })
