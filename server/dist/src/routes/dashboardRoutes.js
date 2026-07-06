"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Dashboard Analytics (Protected)
router.get("/stats", auth_1.authenticate, dashboardController_1.getDashboardStats);
router.get("/reports", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), dashboardController_1.getSalesReports);
router.get("/customer-reports", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), dashboardController_1.getCustomerSalesAndDueReports);
router.get("/customer-reports/:customerId", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), dashboardController_1.getCustomerDetailedReport);
// Shift Management (Hub/Staff specific)
router.post("/shift/open", auth_1.authenticate, dashboardController_1.openShift);
router.post("/shift/close", auth_1.authenticate, dashboardController_1.closeShift);
exports.default = router;
