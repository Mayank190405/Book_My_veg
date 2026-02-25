import { Router } from "express";
import { createCoupon, listCoupons, validateCoupon, createCouponSchema } from "../controllers/couponController";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// Public / User
router.post("/validate", validateCoupon); // Used in Cart

// Admin
router.post("/", authenticate, authorize(["ADMIN"]), validate(createCouponSchema), createCoupon);
router.get("/", authenticate, authorize(["ADMIN"]), listCoupons);

export default router;
