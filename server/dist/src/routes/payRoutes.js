"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const router = (0, express_1.Router)();
// Public routes for customer bill payment and dues settlement
router.get("/pay-info", paymentController_1.getPayInfo);
router.post("/pay-due", paymentController_1.initiatePayDue);
exports.default = router;
