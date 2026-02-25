import { Router } from "express";
import { syncCart, getCart, updateCartItem } from "../controllers/cartController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate); // Protect all cart routes

router.post("/sync", syncCart);
router.get("/", getCart);
router.post("/item", updateCartItem);

export default router;
