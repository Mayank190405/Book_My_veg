"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const unitController_1 = require("../controllers/unitController");
const router = (0, express_1.Router)();
router.get("/", unitController_1.getUnits);
// Admin Routes
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), unitController_1.createUnit);
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), unitController_1.updateUnit);
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), unitController_1.deleteUnit);
exports.default = router;
