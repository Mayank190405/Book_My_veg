import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controllers/categoryController";

const router = Router();

router.get("/", getCategories);
router.get("/:id", getCategoryById);

// Admin Routes
router.post("/", authenticate, authorize(["ADMIN"]), createCategory);
router.put("/:id", authenticate, authorize(["ADMIN"]), updateCategory);
router.delete("/:id", authenticate, authorize(["ADMIN"]), deleteCategory);

export default router;
