"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderController_1 = require("../controllers/orderController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const orderSchemas_1 = require("../schemas/orderSchemas");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ── Admin (Role-specific Assignments & Management) ──────────────────────────
router.get("/admin/all", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), orderController_1.getAllOrders);
// ── Packer ───────────────────────────────────────────────────────────────────
router.get("/packing/assignments", (0, auth_1.authorize)(["PACKING", "ADMIN", "STORE_ADMIN"]), orderController_1.getOrdersForPacking);
router.get("/packing/pending", (0, auth_1.authorize)(["PACKING", "ADMIN", "STORE_ADMIN"]), orderController_1.getOrdersForPacking);
router.post("/packing/create-order", (0, auth_1.authorize)(["PACKING", "ADMIN", "STORE_ADMIN"]), orderController_1.createPackerOrder);
router.post("/packing/validate-qr", (0, auth_1.authorize)(["PACKING", "ADMIN", "STORE_ADMIN"]), orderController_1.validatePackerQr);
router.get("/packing/count", (0, auth_1.authorize)(["PACKING", "ADMIN", "STORE_ADMIN"]), orderController_1.getPackedOrdersCount);
router.patch("/packing/:id/details", (0, auth_1.authorize)(["PACKING", "ADMIN", "STORE_ADMIN"]), orderController_1.updatePackingDetails);
// ── Driver ───────────────────────────────────────────────────────────────────
router.get("/driver/assigned", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.getAssignedOrders);
router.get("/driver/returns", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.getDriverReturns);
router.post("/driver/claim-qr", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.claimDeliveryQr);
router.post("/driver/collect-cash", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.collectCashDirect);
router.post("/driver/send-cash-otp", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.sendCashCollectionOtp);
router.post("/driver/verify-cash-otp", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.verifyCashCollectionOtp);
router.patch("/driver/:id/deliver", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.markOrderDelivered);
router.post("/driver/:id/otp", (0, auth_1.authorize)(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), orderController_1.sendDeliveryOtp);
// ── Customer / Shared Queries ────────────────────────────────────────────────
router.post("/", (0, rateLimiter_1.rateLimiter)(50, 3600), (0, validate_1.validate)(orderSchemas_1.createOrderSchema), orderController_1.createOrder);
router.get("/", orderController_1.getOrders); // cursor: ?cursor=xxx&limit=10
router.get("/customer/:customerId/dues", orderController_1.getCustomerOutstandingDues);
// ── Status & Assignments by Order ID ─────────────────────────────────────────
router.patch("/:id/status", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "DELIVERY_PARTNER", "PACKING"]), orderController_1.updateOrderStatus);
router.patch("/:id/payment", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "DELIVERY_PARTNER"]), orderController_1.updateOrderPaymentStatus);
router.patch("/:id/assign-packer", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), orderController_1.assignPacker);
router.patch("/:id/assign-driver", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), orderController_1.assignDriver);
router.post("/:id/cancel", orderController_1.cancelOrder); // state-machine guarded
// ── Catch-All Single Order Fetch (Must be last) ───────────────────────────────
router.get("/:id", orderController_1.getOrderById);
exports.default = router;
