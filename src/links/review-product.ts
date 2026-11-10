import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import ReviewsModule from "../modules/reviews"

// Read-only: `review.product.*` in query.graph through review.product_id, no link table.
export default defineLink({ linkable: ReviewsModule.linkable.review, field: "product_id" }, ProductModule.linkable.product, { readOnly: true })
