import { Router } from "express";
import * as cmsController from "../controllers/cmsController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Public SDUI Feed
router.get("/home/feed", cmsController.getHomeFeed);

// Admin CMS Endpoints
router.use(authenticate, authorize(["ADMIN", "STORE_ADMIN"]));

router.get("/sections", cmsController.getAllSections);
router.get("/sections/:id", cmsController.getSectionById);
router.post("/sections", cmsController.createSection);
router.put("/sections/:id", cmsController.updateSection);
router.post("/sections/reorder", cmsController.reorderSections);
router.post("/sections/:id/duplicate", cmsController.duplicateSection);
router.patch("/sections/:id/toggle", cmsController.toggleSectionStatus);
router.delete("/sections/:id", cmsController.deleteSection);

export default router;
