import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { getProductReviews, createReview, deleteReview } from "../controllers/reviewController";
import { validate } from "../middleware/validate";
import { createReviewSchema } from "../schemas/reviewSchemas";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/product/:productId", getProductReviews);
router.post("/", authenticate, rateLimiter, validate(createReviewSchema), createReview);
router.delete("/:id", authenticate, deleteReview);

export default router;
