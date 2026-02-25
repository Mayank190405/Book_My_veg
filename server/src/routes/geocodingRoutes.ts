import { Router } from "express";
import { autocomplete, reverseGeocode } from "../controllers/geocodingController";

const router = Router();

router.get("/autocomplete", autocomplete);
router.get("/reverse", reverseGeocode);

export default router;
