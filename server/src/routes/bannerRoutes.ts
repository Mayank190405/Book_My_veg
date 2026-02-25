import { Router } from "express";
import * as bannerController from "../controllers/bannerController";

const router = Router();

router.get("/", bannerController.getBanners);
router.post("/", bannerController.createBanner);
router.put("/:id", bannerController.updateBanner);
router.delete("/:id", bannerController.deleteBanner);
router.patch("/:id/toggle", bannerController.toggleBanner);

export default router;
