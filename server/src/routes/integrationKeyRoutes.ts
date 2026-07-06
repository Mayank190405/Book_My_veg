import { Router } from "express";
import {
    createApiKey,
    listApiKeys,
    toggleApiKey,
    deleteApiKey
} from "../controllers/integrationKeyController";

const router = Router();

router.post("/", createApiKey);
router.get("/", listApiKeys);
router.patch("/:id/toggle", toggleApiKey);
router.delete("/:id", deleteApiKey);

export default router;
