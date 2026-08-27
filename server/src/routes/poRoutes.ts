import { Router } from "express";
import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    reviewPurchaseOrder,
    receivePurchaseOrder,
    assignPurchaseManagerStores,
    getPurchaseManagerAssignedStores,
    sendPOToVendorWhatsApp
} from "../controllers/poController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// ─── Purchase Orders ──────────────────────────────────────────────────────────
router.post("/", authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER", "MANAGER"]), createPurchaseOrder);
router.get("/", authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER", "MANAGER"]), getPurchaseOrders);
router.get("/assigned-stores", getPurchaseManagerAssignedStores);
router.get("/:id", authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER", "MANAGER"]), getPurchaseOrderById);
router.put("/:id/review", authorize(["ADMIN", "SUPER_ADMIN", "PURCHASE_MANAGER", "STORE_ADMIN"]), reviewPurchaseOrder);
router.post("/:id/receive", authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER", "MANAGER"]), receivePurchaseOrder);
router.post("/:id/send-whatsapp", authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "PURCHASE_MANAGER", "MANAGER", "POS_OPERATOR"]), sendPOToVendorWhatsApp);
router.post("/managers/assign", authorize(["ADMIN", "SUPER_ADMIN"]), assignPurchaseManagerStores);

export default router;

