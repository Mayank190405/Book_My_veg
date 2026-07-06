"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const inventoryController_1 = require("../controllers/inventoryController");
const router = (0, express_1.Router)();
// Enforce mandatory authorization for all repository fulfillment nodes
router.use(auth_1.authenticate);
router.get("/store/:locationId", inventoryController_1.getStoreInventory);
router.patch("/:id", inventoryController_1.adjustStock);
router.post("/adjust", inventoryController_1.createAdjustment);
router.post("/sync", inventoryController_1.syncInventory);
router.post("/transfer", inventoryController_1.transferStock);
router.post("/batch", inventoryController_1.addInwardStock);
router.get("/batch/:locationId", inventoryController_1.getInwardHistory);
router.post("/mortality", inventoryController_1.recordMortality);
router.get("/mortality/:locationId", inventoryController_1.getMortalityHistory);
exports.default = router;
