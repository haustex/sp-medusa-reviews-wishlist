import { model } from "@medusajs/framework/utils"
import Review from "./review"

/**
 * A photo attached to a review. While the review is pending the file is private (no public URL); on approval it is
 * copied to a public file and `url` is set; on rejection the private file is deleted.
 */
const ReviewImage = model
  .define("review_image", {
    id: model.id({ prefix: "revimg" }).primaryKey(),
    review: model.belongsTo(() => Review, { mappedBy: "images" }),
    /** File Module id of the private copy (null once published or deleted). */
    private_file_id: model.text().nullable(),
    /** File Module id of the public copy (set on approval). */
    file_id: model.text().nullable(),
    url: model.text().nullable(),
    mime_type: model.text(),
    size: model.number(),
    position: model.number().default(0),
  })
  .indexes([{ on: ["review_id"] }])

export default ReviewImage
