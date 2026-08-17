"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const paymentController_1 = require("../controllers/paymentController");
const router = (0, express_1.Router)();
// Webhook (No auth, validated by signature) - Must be before auth middleware if using router.use
router.post("/webhook", paymentController_1.handleWebhook);
router.post("/easebuzz/callback", paymentController_1.handleEasebuzzCallback);
router.use(auth_1.authenticate);
router.get("/eligibility", paymentController_1.checkPaymentEligibility);
router.post("/initiate", paymentController_1.initiatePayment);
router.post("/:orderId/generate-link", paymentController_1.generatePaymentLink);
router.post("/verify", paymentController_1.verifyPayment);
router.get("/order-status/:orderId", paymentController_1.getOrderStatus);
// Admin & Operational Sync
router.post("/refund", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), paymentController_1.refundPayment);
router.post("/easebuzz/sync", (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), paymentController_1.triggerEasebuzzSync);
router.post("/cleanup-duplicates", (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), paymentController_1.cleanupDuplicatePaymentsController);
exports.default = router;
