"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const pageContentController_1 = require("../controllers/pageContentController");
const router = (0, express_1.Router)();
// Public route to list all policies/pages
router.get("/", pageContentController_1.listPageContents);
// Public route to view policy/page content
router.get("/:slug", pageContentController_1.getPageContent);
// Protected routes to edit or delete page content (Admin / Super Admin / Store Admin only)
router.put("/:slug", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]), pageContentController_1.updatePageContent);
router.delete("/:slug", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]), pageContentController_1.deletePageContent);
exports.default = router;
