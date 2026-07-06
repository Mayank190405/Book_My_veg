"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const posController_1 = require("../controllers/posController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "POS_OPERATOR"]));
// ─── Customer Node ────────────────────────────────────────────────────────────
router.get("/customers/search", posController_1.searchCustomer);
router.post("/customers/upsert", posController_1.createOrUpdateCustomer);
router.get("/customers/:customerId/history", posController_1.getCustomerHistory);
router.post("/customers/:customerId/settle", posController_1.settleAccountBalance);
// ─── Transaction Node ─────────────────────────────────────────────────────────
router.post("/orders/process", posController_1.processPOSOrder);
router.get("/products/store", posController_1.getStoreProducts);
// ─── Store Config ─────────────────────────────────────────────────────────────
router.get("/store/config", posController_1.getStoreConfig);
// ─── Cancellation & Due Collection ────────────────────────────────────────────
router.post("/orders/:orderId/cancel", posController_1.cancelPOSOrder);
router.post("/orders/:orderId/collect-due", posController_1.collectDuePayment);
exports.default = router;
