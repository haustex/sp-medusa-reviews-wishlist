import { MedusaService } from "@medusajs/framework/utils"
import { ProductRating, Review, ReviewImage, ReviewOptOut, ReviewReply, ReviewRequest, ReviewUpload } from "./models"

class ReviewsModuleService extends MedusaService({
  Review,
  ReviewImage,
  ReviewReply,
  ReviewUpload,
  ReviewRequest,
  ReviewOptOut,
  ProductRating,
}) {}

export default ReviewsModuleService
