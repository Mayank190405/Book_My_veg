import { Router } from "express";
import * as storeMaintenanceController from "../controllers/storeMaintenanceController";
import { authenticate, authorize } from "../middleware/auth";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/costs/:locationId", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), storeMaintenanceController.getStoreCosts);
router.post("/costs", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), storeMaintenanceController.recordStoreCost);
router.post("/products/bulk-delete", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), storeMaintenanceController.bulkDeleteProducts);
router.get("/products/export", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), storeMaintenanceController.exportProducts);
router.post("/products/bulk-import", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), upload.single("file"), storeMaintenanceController.bulkImportProducts);
router.post("/products/toggle-publishing", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), storeMaintenanceController.toggleWebsitePublishing);

export default router;
