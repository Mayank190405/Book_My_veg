"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const couponController_1 = require("../controllers/couponController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
// Public / User
router.post("/validate", couponController_1.validateCoupon); // Used in Cart
// Admin
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), (0, validate_1.validate)(couponController_1.createCouponSchema), couponController_1.createCoupon);
router.get("/", auth_1.authenticate, couponController_1.listCoupons);
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), couponController_1.updateCoupon);
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), couponController_1.deleteCoupon);
exports.default = router;
