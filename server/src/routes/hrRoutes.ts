import { Router } from "express";
import * as hrController from "../controllers/hrController";

const router = Router();

router.post("/check-in", hrController.checkIn);
router.post("/check-out", hrController.checkOut);
router.post("/salary", hrController.recordSalary);
router.get("/attendance/:userId", hrController.getAttendance);
router.get("/staff", hrController.listStaff);
router.patch("/staff/:userId", hrController.updateStaff);

export default router;
