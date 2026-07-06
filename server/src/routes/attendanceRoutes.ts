
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { 
    markAttendance,
    getStoreAttendance,
    getUserAttendance
} from "../controllers/attendanceController";

const router = Router();

router.use(authenticate);

router.post("/mark", markAttendance);
router.get("/store/:locationId", getStoreAttendance);
router.get("/user/:userId", getUserAttendance);

export default router;
