import CustomerModule from "@medusajs/medusa/customer"
import { defineLink } from "@medusajs/framework/utils"
import ReviewsModule from "../modules/reviews"

export default defineLink({ linkable: ReviewsModule.linkable.review, field: "customer_id" }, CustomerModule.linkable.customer, { readOnly: true })
