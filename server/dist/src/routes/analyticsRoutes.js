"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsController_1 = require("../controllers/analyticsController");
const router = (0, express_1.Router)();
router.get("/overview", analyticsController_1.getApiUsageOverview);
router.get("/top-apis", analyticsController_1.getTopApis);
router.get("/security", analyticsController_1.getSecurityMetrics);
exports.default = router;
