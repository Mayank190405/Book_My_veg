import { Router } from "express";
import {
    listIncidents,
    getIncidentDetail,
    updateIncident,
    addIncidentComment
} from "../controllers/incidentController";

const router = Router();

router.get("/", listIncidents);
router.get("/:id", getIncidentDetail);
router.put("/:id", updateIncident);
router.post("/:id/comments", addIncidentComment);

export default router;
