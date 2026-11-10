import { model } from "@medusajs/framework/utils"

export const REVIEW_REQUEST_STATUSES = ["scheduled", "sent", "used", "expired", "skipped", "failed", "opted_out"] as const
export type ReviewRequestStatus = (typeof REVIEW_REQUEST_STATUSES)[number]

/** The one review-request e-mail an order may get, and the magic link it carries. */
const ReviewRequest = model
  .define("review_request", {
    id: model.id({ prefix: "revreq" }).primaryKey(),
    order_id: model.text().unique(),
    customer_id: model.text().nullable(),
    email: model.text(),
    email_hash: model.text(),
    /** SHA-256 of the magic-link token; the token itself only lives in the e-mail. */
    token_hash: model.text().unique().nullable(),
    trigger: model.text(),
    delay_days: model.number(),
    scheduled_at: model.dateTime(),
    sent_at: model.dateTime().nullable(),
    expires_at: model.dateTime().nullable(),
    used_at: model.dateTime().nullable(),
    status: model.enum([...REVIEW_REQUEST_STATUSES]).default("scheduled"),
    locale: model.text().nullable(),
    region_id: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    attempts: model.number().default(0),
    last_error: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ["status", "scheduled_at"] }, { on: ["email_hash"] }, { on: ["customer_id"] }])

export default ReviewRequest
