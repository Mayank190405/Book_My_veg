import { Router } from "express";
import {
    createOrder,
    getOrders,
    getOrderById,
    cancelOrder,
    getAllOrders,
    updateOrderStatus,
    updateOrderPaymentStatus,
    getAssignedOrders,
    getOrdersForPacking,
    getPackedOrdersCount,
    updatePackingDetails,
    sendDeliveryOtp,
    assignPacker,
    assignDriver,
    createPackerOrder,
    validatePackerQr,
    claimDeliveryQr,
    getCustomerOutstandingDues,
    sendCashCollectionOtp,
    verifyCashCollectionOtp,
    collectCashDirect,
    markOrderDelivered,
    getDriverReturns,
} from "../controllers/orderController";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema } from "../schemas/orderSchemas";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.use(authenticate);

// ── Admin (Role-specific Assignments & Management) ──────────────────────────
router.get("/admin/all", authorize(["ADMIN", "STORE_ADMIN"]), getAllOrders);

// ── Packer ───────────────────────────────────────────────────────────────────
router.get("/packing/assignments", authorize(["PACKING", "ADMIN", "STORE_ADMIN"]), getOrdersForPacking);
router.get("/packing/pending", authorize(["PACKING", "ADMIN", "STORE_ADMIN"]), getOrdersForPacking);
router.post("/packing/create-order", authorize(["PACKING", "ADMIN", "STORE_ADMIN"]), createPackerOrder);
router.post("/packing/validate-qr", authorize(["PACKING", "ADMIN", "STORE_ADMIN"]), validatePackerQr);
router.get("/packing/count", authorize(["PACKING", "ADMIN", "STORE_ADMIN"]), getPackedOrdersCount);
router.patch("/packing/:id/details", authorize(["PACKING", "ADMIN", "STORE_ADMIN"]), updatePackingDetails);

// ── Driver ───────────────────────────────────────────────────────────────────
router.get("/driver/assigned", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), getAssignedOrders);
router.get("/driver/returns", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), getDriverReturns);
router.post("/driver/claim-qr", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), claimDeliveryQr);
router.post("/driver/collect-cash", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), collectCashDirect);
router.post("/driver/:id/collect-cash", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), collectCashDirect);
router.post("/driver/send-cash-otp", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), sendCashCollectionOtp);
router.post("/driver/:id/send-cash-otp", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), sendCashCollectionOtp);
router.post("/driver/verify-cash-otp", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), verifyCashCollectionOtp);
router.post("/driver/:id/verify-cash-otp", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), verifyCashCollectionOtp);
router.patch("/driver/:id/deliver", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), markOrderDelivered);
router.post("/driver/:id/otp", authorize(["DELIVERY_PARTNER", "ADMIN", "STORE_ADMIN"]), sendDeliveryOtp);

// ── Customer / Shared Queries ────────────────────────────────────────────────
router.post("/", rateLimiter(50, 3600), validate(createOrderSchema), createOrder);
router.get("/", getOrders);           // cursor: ?cursor=xxx&limit=10
router.get("/customer/:customerId/dues", getCustomerOutstandingDues);

// ── Status & Assignments by Order ID ─────────────────────────────────────────
router.patch("/:id/status", authorize(["ADMIN", "STORE_ADMIN", "DELIVERY_PARTNER", "PACKING"]), updateOrderStatus);
router.patch("/:id/payment", authorize(["ADMIN", "STORE_ADMIN", "DELIVERY_PARTNER"]), updateOrderPaymentStatus);
router.patch("/:id/assign-packer", authorize(["ADMIN", "STORE_ADMIN"]), assignPacker);
router.patch("/:id/assign-driver", authorize(["ADMIN", "STORE_ADMIN"]), assignDriver);
router.post("/:id/cancel", cancelOrder);         // state-machine guarded

// ── Catch-All Single Order Fetch (Must be last) ───────────────────────────────
router.get("/:id", getOrderById);

export default router;