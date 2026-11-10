import { model } from "@medusajs/framework/utils"
import ReviewImage from "./review-image"
import ReviewReply from "./review-reply"

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

const Review = model
  .define("review", {
    id: model.id({ prefix: "rev" }).primaryKey(),
    product_id: model.text(),
    variant_id: model.text().nullable(),
    order_id: model.text(),
    /** One review per purchased line item: the verified-purchase guarantee. */
    order_item_id: model.text().unique(),
    customer_id: model.text().nullable(),
    /** Only used to match the customer later (anonymised on deletion); never returned by the Store API. */
    email: model.text().nullable(),
    display_name: model.text(),
    rating: model.number(),
    title: model.text().nullable(),
    body: model.text(),
    locale: model.text().nullable(),
    status: model.enum([...REVIEW_STATUSES]).default("pending"),
    verified: model.boolean().default(true),
    /** Where the review came from; "store" for reviews written on the storefront. */
    source: model.text().default("store"),
    ip_hash: model.text().nullable(),
    approved_at: model.dateTime().nullable(),
    rejected_at: model.dateTime().nullable(),
    moderated_by: model.text().nullable(),
    reject_reason: model.text().nullable(),
    metadata: model.json().nullable(),
    images: model.hasMany(() => ReviewImage, { mappedBy: "review" }),
    reply: model.hasOne(() => ReviewReply, { mappedBy: "review" }).nullable(),
  })
  .indexes([{ on: ["product_id", "status"] }, { on: ["order_id"] }, { on: ["customer_id"] }, { on: ["email"] }])

export default Review
