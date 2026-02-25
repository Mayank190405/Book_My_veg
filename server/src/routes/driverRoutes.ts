import { Router } from "express";
import * as driverController from "../controllers/driverController";

const router = Router();

router.get("/assigned/:driverId", driverController.getAssignedDeliveries);
router.post("/pickup/:assignmentId", driverController.pickUpOrder);
router.post("/complete/:assignmentId", driverController.completeDelivery);
router.get("/hdfc-link/:orderId", driverController.generateHDFCLink);

export default router;
