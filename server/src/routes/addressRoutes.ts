import { Router } from "express";
import { getAddresses, createAddress, updateAddress, deleteAddress } from "../controllers/addressController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", getAddresses);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);

export default router;
