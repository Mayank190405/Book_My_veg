import { Router } from "express";
import * as bannerController from "../controllers/bannerController";

import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", bannerController.getBanners);

// ── Admin ───────────────────────────────────────────────────────────────────
router.use(authenticate, authorize(["ADMIN", "STORE_ADMIN"]));

router.post("/", bannerController.createBanner);
router.put("/:id", bannerController.updateBanner);
router.delete("/:id", bannerController.deleteBanner);
router.patch("/:id/toggle", bannerController.toggleBanner);

export default router;
