"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes for customer bill payment and dues settlement
router.get("/pay-info", paymentController_1.getPayInfo);
router.post("/pay-due", paymentController_1.initiatePayDue);
router.post("/verify", paymentController_1.verifyPayment);
router.post("/onboard", paymentController_1.publicCustomerOnboard);
router.post("/order-feedback", paymentController_1.saveOrderFeedback);
// Payment reminder - Authenticated staff only
router.post("/send-reminder", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]), paymentController_1.sendPaymentReminderController);
exports.default = router;
