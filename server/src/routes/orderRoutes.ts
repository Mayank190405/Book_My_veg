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
} from "../controllers/orderController";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema } from "../schemas/orderSchemas";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.use(authenticate);

// ── Customer ─────────────────────────────────────────────────────────────────
router.post("/", rateLimiter(50, 3600), validate(createOrderSchema), createOrder);
router.get("/", getOrders);           // cursor: ?cursor=xxx&limit=10
router.get("/:id", getOrderById);
router.post("/:id/cancel", cancelOrder);         // state-machine guarded

// ── Admin (Role-specific Assignments & Management) ──────────────────────────
router.get("/admin/all", authorize(["ADMIN", "STORE_ADMIN"]), getAllOrders);
router.patch("/:id/status", authorize(["ADMIN", "STORE_ADMIN", "DELIVERY_PARTNER", "PACKING"]), updateOrderStatus);
router.patch("/:id/payment", authorize(["ADMIN", "STORE_ADMIN", "DELIVERY_PARTNER"]), updateOrderPaymentStatus);
router.patch("/:id/assign-packer", authorize(["ADMIN", "STORE_ADMIN"]), assignPacker);
router.patch("/:id/assign-driver", authorize(["ADMIN", "STORE_ADMIN"]), assignDriver);

// ── Packer ───────────────────────────────────────────────────────────────────
router.get("/packing/assignments", authorize(["PACKING"]), getOrdersForPacking);
router.get("/packing/count", authorize(["PACKING"]), getPackedOrdersCount);
router.patch("/packing/:id/details", authorize(["PACKING"]), updatePackingDetails);

// ── Driver ───────────────────────────────────────────────────────────────────
router.get("/driver/assigned", authorize(["DELIVERY_PARTNER"]), getAssignedOrders);
router.post("/driver/:id/otp", authorize(["DELIVERY_PARTNER"]), sendDeliveryOtp);

export default router;