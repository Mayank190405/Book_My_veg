import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
    getProducts,
    getTrendingProducts,
    getFlashDeals,
    getProductById,
    getSimilarProducts,
    checkServiceability,
    createProduct,
    updateProduct,
    deleteProduct,
    getBuyAgain,
    bulkDeleteProducts,
    bulkUploadProducts
} from "../controllers/productController";

const router = Router();

router.get("/", getProducts);
router.get("/trending", getTrendingProducts);
router.get("/flash-deals", getFlashDeals);
router.get("/check-pincode/:pincode", checkServiceability);
router.get("/buy-again", authenticate, getBuyAgain);
router.get("/:id/similar", getSimilarProducts);
router.get("/:id", getProductById);

// Admin Routes
router.post("/", authenticate, authorize(["ADMIN"]), createProduct);
router.put("/:id", authenticate, authorize(["ADMIN"]), updateProduct);
router.delete("/:id", authenticate, authorize(["ADMIN"]), deleteProduct);
router.post("/bulk-delete", authenticate, authorize(["ADMIN"]), bulkDeleteProducts);
router.post("/bulk-upload", authenticate, authorize(["ADMIN"]), bulkUploadProducts);

export default router;
