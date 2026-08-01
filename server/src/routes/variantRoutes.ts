import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
    getVariants,
    getVariantById,
    createVariant,
    updateVariant,
    toggleVariantStatus,
    deleteVariant
} from "../controllers/variantController";

const router = Router();

// Public / Authenticated read routes
router.get("/", getVariants);
router.get("/:id", getVariantById);

// Admin / Store Admin routes
router.post("/", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), createVariant);
router.put("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), updateVariant);
router.patch("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), updateVariant);
router.patch("/:id/toggle", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), toggleVariantStatus);
router.delete("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), deleteVariant);

export default router;
