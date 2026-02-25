import { Router } from "express";
import {
    createOrder,
    getOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
    processWebOrder,
    getAssignedOrdersForPacker,
    submitPackedOrder,
} from "../controllers/orderController";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema } from "../schemas/orderSchemas";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.use(authenticate);

// ── Customer ─────────────────────────────────────────────────────────────────
router.post("/", rateLimiter, validate(createOrderSchema), createOrder);
router.get("/", getOrders);           // cursor: ?cursor=xxx&limit=10
router.get("/:id", getOrderById);
router.post("/:id/cancel", cancelOrder);         // state-machine guarded
router.post("/:id/process-web-order", processWebOrder);

// ── Packer ────────────────────────────────────────────────────────────────────
router.get("/packer/assigned", authorize(["STAFF", "ADMIN"]), getAssignedOrdersForPacker);
router.post("/packer/:id/pack", authorize(["STAFF", "ADMIN"]), submitPackedOrder);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get("/admin/all", authorize(["ADMIN", "STAFF"]), getAllOrders);      // cursor: ?cursor=xxx&limit=20&status=PENDING
router.put("/:id/status", authorize(["ADMIN", "STAFF"]), updateOrderStatus); // state-machine guarded

export default router;
