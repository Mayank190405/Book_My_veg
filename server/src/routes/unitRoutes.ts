import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
    getUnits,
    createUnit,
    updateUnit,
    deleteUnit
} from "../controllers/unitController";

const router = Router();

router.get("/", getUnits);

// Admin Routes
router.post("/", authenticate, authorize(["ADMIN"]), createUnit);
router.put("/:id", authenticate, authorize(["ADMIN"]), updateUnit);
router.delete("/:id", authenticate, authorize(["ADMIN"]), deleteUnit);

export default router;
