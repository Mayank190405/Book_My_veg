import { Router } from "express";
import {
    getLocations,
    getLocationById,
    createLocation,
    updateLocation,
    getLocationBySlug,
    deleteLocation,
    getSeoSitemapData
} from "../controllers/locationController";

const router = Router();

router.get("/", getLocations);
router.get("/seo-data", getSeoSitemapData);
router.get("/:id", getLocationById);
router.get("/slug/:slug", getLocationBySlug);
router.post("/", createLocation);
router.put("/:id", updateLocation);
router.patch("/:id", updateLocation);
router.delete("/:id", deleteLocation);

export default router;
