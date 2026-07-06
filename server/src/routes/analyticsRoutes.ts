import { Router } from "express";
import {
    getApiUsageOverview,
    getTopApis,
    getSecurityMetrics
} from "../controllers/analyticsController";

const router = Router();

router.get("/overview", getApiUsageOverview);
router.get("/top-apis", getTopApis);
router.get("/security", getSecurityMetrics);

export default router;
