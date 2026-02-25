import { Router } from "express";
import { logMortality, getMortalityLogs } from "../controllers/mortalityController";

const router = Router();

router.post("/log", logMortality);
router.get("/list", getMortalityLogs);

export default router;
