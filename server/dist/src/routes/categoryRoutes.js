"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const productSchemas_1 = require("../schemas/productSchemas");
const categoryController_1 = require("../controllers/categoryController");
const router = (0, express_1.Router)();
router.get("/", categoryController_1.getCategories);
router.get("/:id", (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), categoryController_1.getCategoryById);
// Admin/Manager Routes
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER"]), categoryController_1.createCategory);
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER"]), (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), categoryController_1.updateCategory);
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER"]), (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), categoryController_1.deleteCategory);
exports.default = router;
