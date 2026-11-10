import { model } from "@medusajs/framework/utils"

/**
 * A photo uploaded before the review exists (private file). `owner` is the customer id or the hash of the magic-link
 * token that uploaded it; only that owner may attach it. Unattached uploads are removed by a job after 24 h.
 */
const ReviewUpload = model
  .define("review_upload", {
    id: model.id({ prefix: "revup" }).primaryKey(),
    owner: model.text(),
    file_id: model.text(),
    mime_type: model.text(),
    size: model.number(),
  })
  .indexes([{ on: ["owner"] }])

export default ReviewUpload
