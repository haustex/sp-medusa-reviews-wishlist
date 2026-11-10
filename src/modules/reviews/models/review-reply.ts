import { model } from "@medusajs/framework/utils"
import Review from "./review"

/** The store's public answer to a review. */
const ReviewReply = model.define("review_reply", {
  id: model.id({ prefix: "revrep" }).primaryKey(),
  review: model.belongsTo(() => Review, { mappedBy: "reply" }),
  body: model.text(),
  author_id: model.text().nullable(),
  author_name: model.text().nullable(),
})

export default ReviewReply
