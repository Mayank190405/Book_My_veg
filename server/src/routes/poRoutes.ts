import { Router } from "express";
import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    reviewPurchaseOrder,
    receivePurchaseOrder,
    assignPurchaseManagerStores,
    getPurchaseManagerAssignedStores
} from "../controllers/poController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// ─── Purchase Orders ──────────────────────────────────────────────────────────
router.post("/", authorize(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), createPurchaseOrder);
router.get("/", authorize(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), getPurchaseOrders);
router.get("/assigned-stores", getPurchaseManagerAssignedStores);
router.get("/:id", authorize(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), getPurchaseOrderById);
router.put("/:id/review", authorize(["ADMIN", "PURCHASE_MANAGER"]), reviewPurchaseOrder);
router.post("/:id/receive", authorize(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), receivePurchaseOrder);
router.post("/managers/assign", authorize(["ADMIN"]), assignPurchaseManagerStores);

export default router;
