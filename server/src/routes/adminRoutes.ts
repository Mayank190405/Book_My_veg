import { Router } from "express";
import { getDashboardStats } from "../controllers/adminController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(authorize(["ADMIN"]));

router.get("/stats", getDashboardStats);

export default router;
