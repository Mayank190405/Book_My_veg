"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const variantController_1 = require("../controllers/variantController");
const router = (0, express_1.Router)();
// Public / Authenticated read routes
router.get("/", variantController_1.getVariants);
router.get("/:id", variantController_1.getVariantById);
// Admin / Store Admin routes
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), variantController_1.createVariant);
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), variantController_1.updateVariant);
router.patch("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), variantController_1.updateVariant);
router.patch("/:id/toggle", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), variantController_1.toggleVariantStatus);
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), variantController_1.deleteVariant);
exports.default = router;
