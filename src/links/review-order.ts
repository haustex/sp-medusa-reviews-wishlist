import OrderModule from "@medusajs/medusa/order"
import { defineLink } from "@medusajs/framework/utils"
import ReviewsModule from "../modules/reviews"

export default defineLink({ linkable: ReviewsModule.linkable.review, field: "order_id" }, OrderModule.linkable.order, { readOnly: true })
