import { Router } from "express";
import { createCoupon, listCoupons, validateCoupon, createCouponSchema, updateCoupon, deleteCoupon } from "../controllers/couponController";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// Public / User
router.post("/validate", validateCoupon); // Used in Cart

// Admin
router.post("/", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), validate(createCouponSchema), createCoupon);
router.get("/", authenticate, listCoupons);
router.put("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), updateCoupon);
router.delete("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), deleteCoupon);

export default router;
