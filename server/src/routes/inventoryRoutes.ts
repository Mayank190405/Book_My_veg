import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { 
    getStoreInventory, 
    adjustStock, 
    syncInventory,
    createAdjustment,
    transferStock,
    addInwardStock,
    getInwardHistory,
    recordMortality,
    getMortalityHistory
} from "../controllers/inventoryController";

const router = Router();

// Enforce mandatory authorization for all repository fulfillment nodes
router.use(authenticate);

router.get("/store/:locationId", getStoreInventory);
router.patch("/:id", adjustStock);
router.post("/adjust", createAdjustment);
router.post("/sync", syncInventory);
router.post("/transfer", transferStock);
router.post("/batch", addInwardStock);
router.get("/batch/:locationId", getInwardHistory);
router.post("/mortality", recordMortality);
router.get("/mortality/:locationId", getMortalityHistory);

export default router;
