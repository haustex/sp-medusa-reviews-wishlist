import { authenticate, defineMiddlewares, validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import multer from "multer"
import {
  AdminBatchReviews,
  AdminListReviewRequests,
  AdminListReviews,
  AdminRefreshRatings,
  AdminReply,
  AdminScheduleReviewRequest,
  AdminUpdateReview,
  StoreCreateReviews,
  StoreEligibility,
  StoreListReviews,
  StoreRatings,
  StoreWishlistAddItem,
  StoreWishlistCounts,
  StoreWishlistMerge,
} from "./validators"

// Size and count are re-checked against the plugin options in the route; these are hard ceilings.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 10 } })

// A customer session/token is used when present; a magic-link token may stand in for it (checked in the route).
const customerOptional = authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })
const customerRequired = authenticate("customer", ["session", "bearer"])

export default defineMiddlewares({
  routes: [
    { matcher: "/store/reviews", method: "GET", middlewares: [validateAndTransformQuery(StoreListReviews, {})] },
    { matcher: "/store/reviews", method: "POST", middlewares: [customerOptional, validateAndTransformBody(StoreCreateReviews)] },
    { matcher: "/store/reviews/ratings", method: "GET", middlewares: [validateAndTransformQuery(StoreRatings, {})] },
    { matcher: "/store/reviews/uploads", method: "POST", middlewares: [customerOptional, upload.array("files")] },
    { matcher: "/store/reviews/eligibility", method: "GET", middlewares: [customerRequired, validateAndTransformQuery(StoreEligibility, {})] },
    { matcher: "/store/customers/me/reviews", method: "GET", middlewares: [customerRequired] },
    { matcher: "/store/wishlist", method: "GET", middlewares: [customerOptional] },
    { matcher: "/store/wishlist/items", method: "POST", middlewares: [customerOptional, validateAndTransformBody(StoreWishlistAddItem)] },
    { matcher: "/store/wishlist/items/:id", method: "DELETE", middlewares: [customerOptional] },
    { matcher: "/store/wishlist/merge", method: "POST", middlewares: [customerRequired, validateAndTransformBody(StoreWishlistMerge)] },
    { matcher: "/store/wishlist/share", method: ["POST", "DELETE"], middlewares: [customerRequired] },
    { matcher: "/store/wishlist/counts", method: "GET", middlewares: [validateAndTransformQuery(StoreWishlistCounts, {})] },
    { matcher: "/admin/reviews", method: "GET", middlewares: [validateAndTransformQuery(AdminListReviews, {})] },
    { matcher: "/admin/reviews/batch", method: "POST", middlewares: [validateAndTransformBody(AdminBatchReviews)] },
    { matcher: "/admin/reviews/ratings/refresh", method: "POST", middlewares: [validateAndTransformBody(AdminRefreshRatings)] },
    { matcher: "/admin/reviews/:id", method: "POST", middlewares: [validateAndTransformBody(AdminUpdateReview)] },
    { matcher: "/admin/reviews/:id/reply", method: "POST", middlewares: [validateAndTransformBody(AdminReply)] },
    { matcher: "/admin/review-requests", method: "GET", middlewares: [validateAndTransformQuery(AdminListReviewRequests, {})] },
    { matcher: "/admin/review-requests/schedule", method: "POST", middlewares: [validateAndTransformBody(AdminScheduleReviewRequest)] },
  ],
})
