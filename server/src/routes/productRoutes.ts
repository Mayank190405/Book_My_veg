import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getProductsSchema, pincodeParamsSchema, uuidParamsSchema } from "../schemas/productSchemas";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
    getProducts,
    getProductsAdmin,
    getTrendingProducts,
    getFlashDeals,
    getProductById,
    getSimilarProducts,
    checkServiceability,
    getBuyAgain,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductStatus,
    bulkImportProducts,
    uploadProductImage,
    syncProductPricingHandler,
} from "../controllers/productController";
import { scanImageUpload } from "../middleware/imageScan";

const router = Router();

// Ensure upload directory exists
const tempUploadDir = path.join(__dirname, "../../uploads/temp");
if (!fs.existsSync(tempUploadDir)) {
    fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempUploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `import-${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB file size
    fileFilter: (req, file, cb) => {
        const extname = path.extname(file.originalname).toLowerCase() === ".csv";
        const mimetype = file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only CSV files are allowed"));
    }
});

const handleUpload = (req: any, res: any, next: any) => {
    upload.single("file")(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

router.get("/", validate(getProductsSchema), getProducts);
router.get("/trending", getTrendingProducts);
router.get("/flash-deals", getFlashDeals);
router.get("/check-pincode/:pincode", validate(pincodeParamsSchema), checkServiceability);
router.get("/buy-again", authenticate, getBuyAgain);
router.get("/:id/similar", validate(uuidParamsSchema), getSimilarProducts);
router.get("/admin", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), getProductsAdmin);
router.get("/:id", validate(uuidParamsSchema), getProductById);

// ── Admin ───────────────────────────────────────────────────────────────────
router.post("/sync-pricing", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), syncProductPricingHandler);
router.post("/import", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), handleUpload, bulkImportProducts);
router.post("/upload-image", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), scanImageUpload, uploadProductImage);
router.post("/", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), createProduct);
router.patch("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), validate(uuidParamsSchema), updateProduct);
router.put("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), validate(uuidParamsSchema), updateProduct);
router.delete("/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), validate(uuidParamsSchema), deleteProduct);
router.patch("/:id/toggle", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), validate(uuidParamsSchema), toggleProductStatus);

export default router;
