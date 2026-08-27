import { Router } from "express";
import {
    getVendors,
    getVendorById,
    createVendor,
    updateVendor,
    deleteVendor
} from "../controllers/vendorController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, authorize(["ADMIN", "STORE_ADMIN", "PURCHASE_MANAGER", "MANAGER"]), getVendors);
router.get("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN", "PURCHASE_MANAGER", "MANAGER"]), getVendorById);
router.post("/", authenticate, authorize(["ADMIN", "STORE_ADMIN", "PURCHASE_MANAGER"]), createVendor);
router.put("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN", "PURCHASE_MANAGER"]), updateVendor);
router.delete("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN", "PURCHASE_MANAGER"]), deleteVendor);

export default router;
