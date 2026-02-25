import { Router } from "express";
import {
    getLocations,
    createLocation,
    updateLocation,
    getLocationBySlug
} from "../controllers/locationController";

const router = Router();

router.get("/", getLocations);
router.get("/slug/:slug", getLocationBySlug);
router.post("/", createLocation);
router.patch("/:id", updateLocation);

export default router;
