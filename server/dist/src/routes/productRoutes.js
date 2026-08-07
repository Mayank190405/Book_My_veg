"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const productSchemas_1 = require("../schemas/productSchemas");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const productController_1 = require("../controllers/productController");
const imageScan_1 = require("../middleware/imageScan");
const router = (0, express_1.Router)();
// Ensure upload directory exists
const tempUploadDir = path_1.default.join(__dirname, "../../uploads/temp");
if (!fs_1.default.existsSync(tempUploadDir)) {
    fs_1.default.mkdirSync(tempUploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempUploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `import-${Date.now()}-${file.originalname}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB file size
    fileFilter: (req, file, cb) => {
        const extname = path_1.default.extname(file.originalname).toLowerCase() === ".csv";
        const mimetype = file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only CSV files are allowed"));
    }
});
const handleUpload = (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};
router.get("/", (0, validate_1.validate)(productSchemas_1.getProductsSchema), productController_1.getProducts);
router.get("/trending", productController_1.getTrendingProducts);
router.get("/flash-deals", productController_1.getFlashDeals);
router.get("/check-pincode/:pincode", (0, validate_1.validate)(productSchemas_1.pincodeParamsSchema), productController_1.checkServiceability);
router.get("/buy-again", auth_1.authenticate, productController_1.getBuyAgain);
router.get("/:id/similar", (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), productController_1.getSimilarProducts);
router.get("/admin", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), productController_1.getProductsAdmin);
router.get("/:id", (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), productController_1.getProductById);
// ── Admin ───────────────────────────────────────────────────────────────────
router.post("/sync-pricing", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), productController_1.syncProductPricingHandler);
router.post("/import", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), handleUpload, productController_1.bulkImportProducts);
router.post("/upload-image", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), imageScan_1.scanImageUpload, productController_1.uploadProductImage);
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), productController_1.createProduct);
router.patch("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), productController_1.updateProduct);
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), productController_1.updateProduct);
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), productController_1.deleteProduct);
router.patch("/:id/toggle", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), (0, validate_1.validate)(productSchemas_1.uuidParamsSchema), productController_1.toggleProductStatus);
exports.default = router;
