import { model } from "@medusajs/framework/utils"

/** Aggregate of the approved reviews of one product, refreshed by events (never computed per request). */
const ProductRating = model.define("product_rating", {
  id: model.id({ prefix: "prrat" }).primaryKey(),
  product_id: model.text().unique(),
  average: model.float().default(0),
  count: model.number().default(0),
  count_1: model.number().default(0),
  count_2: model.number().default(0),
  count_3: model.number().default(0),
  count_4: model.number().default(0),
  count_5: model.number().default(0),
  last_review_at: model.dateTime().nullable(),
})

export default ProductRating
