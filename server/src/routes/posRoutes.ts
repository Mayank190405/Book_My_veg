import { Router } from "express";
import { 
    searchCustomer, 
    createOrUpdateCustomer, 
    processPOSOrder, 
    getStoreProducts,
    getCustomerHistory,
    cancelPOSOrder,
    getStoreConfig,
    collectDuePayment,
    settleAccountBalance,
    getWebOrders,
    updateWebOrderStatus,
    getTodayPOSSales,
    getPOSDueCustomers,
    sendPOSWhatsappDueReminders,
    getPOSOrderById
} from "../controllers/posController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.use(authorize(["ADMIN", "STORE_ADMIN", "POS_OPERATOR"]));

// ─── Customer Node ────────────────────────────────────────────────────────────
router.get("/customers/search", searchCustomer);
router.post("/customers/upsert", createOrUpdateCustomer);
router.get("/customers/:customerId/history", getCustomerHistory);
router.post("/customers/:customerId/settle", settleAccountBalance);

// ─── Transaction Node ─────────────────────────────────────────────────────────
router.post("/orders/process", processPOSOrder);
router.get("/orders/web", getWebOrders);
router.get("/orders/today-sales", getTodayPOSSales);
router.get("/orders/single/:orderId", getPOSOrderById);
router.get("/due-customers", getPOSDueCustomers);
router.post("/send-whatsapp-reminders", sendPOSWhatsappDueReminders);
router.post("/orders/:orderId/status", updateWebOrderStatus);
router.patch("/orders/:orderId/status", updateWebOrderStatus);
router.get("/products/store", getStoreProducts);

// ─── Store Config ─────────────────────────────────────────────────────────────
router.get("/store/config", getStoreConfig);

// ─── Cancellation & Due Collection ────────────────────────────────────────────
router.post("/orders/:orderId/cancel", cancelPOSOrder);
router.post("/orders/:orderId/collect-due", collectDuePayment);

export default router;
