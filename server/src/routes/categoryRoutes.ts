import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uuidParamsSchema } from "../schemas/productSchemas";
import {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controllers/categoryController";

const router = Router();

router.get("/", getCategories);
router.get("/:id", validate(uuidParamsSchema), getCategoryById);

// Admin/Manager Routes
router.post("/", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), createCategory);
router.put("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), validate(uuidParamsSchema), updateCategory);
router.delete("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), validate(uuidParamsSchema), deleteCategory);

export default router;
