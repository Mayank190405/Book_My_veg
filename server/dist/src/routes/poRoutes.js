"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const poController_1 = require("../controllers/poController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ─── Purchase Orders ──────────────────────────────────────────────────────────
router.post("/", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), poController_1.createPurchaseOrder);
router.get("/", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), poController_1.getPurchaseOrders);
router.get("/assigned-stores", poController_1.getPurchaseManagerAssignedStores);
router.get("/:id", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), poController_1.getPurchaseOrderById);
router.put("/:id/review", (0, auth_1.authorize)(["ADMIN", "PURCHASE_MANAGER"]), poController_1.reviewPurchaseOrder);
router.post("/:id/receive", (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "POS_OPERATOR", "PURCHASE_MANAGER"]), poController_1.receivePurchaseOrder);
router.post("/managers/assign", (0, auth_1.authorize)(["ADMIN"]), poController_1.assignPurchaseManagerStores);
exports.default = router;
