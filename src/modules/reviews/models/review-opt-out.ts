import { model } from "@medusajs/framework/utils"

/** An address that asked not to receive review requests; only its hash is kept. */
const ReviewOptOut = model.define("review_opt_out", {
  id: model.id({ prefix: "revopt" }).primaryKey(),
  email_hash: model.text().unique(),
  source: model.text().default("link"),
})

export default ReviewOptOut
