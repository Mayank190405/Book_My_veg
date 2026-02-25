import { Router } from "express";
import * as packerController from "../controllers/packerController";

const router = Router();

router.get("/assigned/:packerId", packerController.getAssignedOrders);
router.post("/complete/:orderId", packerController.completePacking);

export default router;
