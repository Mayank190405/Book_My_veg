import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { getPageContent, updatePageContent, listPageContents, deletePageContent } from "../controllers/pageContentController";

const router = Router();

// Public route to list all policies/pages
router.get("/", listPageContents);

// Public route to view policy/page content
router.get("/:slug", getPageContent);

// Protected routes to edit or delete page content (Admin / Super Admin / Store Admin only)
router.put("/:slug", authenticate, authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]), updatePageContent);
router.delete("/:slug", authenticate, authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]), deletePageContent);

export default router;

