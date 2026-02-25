import { Router } from "express";
import * as userAnalyticsController from "../controllers/userAnalyticsController";

const router = Router();

router.get("/leaderboard", userAnalyticsController.getCustomerLeaderboard);
router.get("/khata-oversight", userAnalyticsController.getKhataOversight);
router.post("/create-staff", userAnalyticsController.createOperationalUser);

export default router;
