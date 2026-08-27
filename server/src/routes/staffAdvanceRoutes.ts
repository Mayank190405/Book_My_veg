import { Router } from "express";
import {
    getStaffAdvances,
    createStaffAdvance,
    updateStaffAdvance,
    deleteStaffAdvance
} from "../controllers/staffAdvanceController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), getStaffAdvances);
router.post("/", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), createStaffAdvance);
router.patch("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER"]), updateStaffAdvance);
router.delete("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), deleteStaffAdvance);

export default router;
