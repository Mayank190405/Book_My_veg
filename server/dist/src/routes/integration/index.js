"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const integrationAuth_1 = require("../../middleware/integrationAuth");
const integrationThreatDetector_1 = require("../../middleware/integrationThreatDetector");
const integrationRateLimiter_1 = require("../../middleware/integrationRateLimiter");
const apiMetricTracker_1 = require("../../middleware/apiMetricTracker");
// Controller imports
const userController_1 = require("../../controllers/integration/userController");
const addressController_1 = require("../../controllers/integration/addressController");
const categoryController_1 = require("../../controllers/integration/categoryController");
const productController_1 = require("../../controllers/integration/productController");
const locationController_1 = require("../../controllers/integration/locationController");
const orderController_1 = require("../../controllers/integration/orderController");
const router = (0, express_1.Router)();
// Apply security stack to ALL integration endpoints
router.use(integrationAuth_1.integrationAuthenticate);
router.use(apiMetricTracker_1.apiMetricTracker);
router.use(integrationThreatDetector_1.integrationThreatDetector);
router.use(integrationRateLimiter_1.integrationRateLimiter);
// ── User API ─────────────────────────────────────────────────────────────────
router.get("/users", userController_1.getUsers);
router.get("/users/:id", userController_1.getUserDetail);
router.post("/users", userController_1.createUser);
router.put("/users/:id", userController_1.updateUser);
// ── Address API ──────────────────────────────────────────────────────────────
router.get("/addresses/user/:userId", addressController_1.getUserAddresses);
router.post("/addresses/user/:userId", addressController_1.createUserAddress);
router.put("/addresses/:id", addressController_1.updateUserAddress);
// ── Category API ─────────────────────────────────────────────────────────────
router.get("/categories", categoryController_1.getCategories);
// ── Product & Variant API ────────────────────────────────────────────────────
router.get("/products", productController_1.getProducts);
router.post("/products", productController_1.createProduct);
router.put("/products/:id", productController_1.updateProduct);
router.patch("/products/inventory", productController_1.updateInventory);
router.post("/products/pricing", productController_1.updatePricing);
// ── Location API ─────────────────────────────────────────────────────────────
router.get("/locations", locationController_1.getLocations);
router.get("/locations/:id", locationController_1.getLocationDetail);
// ── Order API ────────────────────────────────────────────────────────────────
router.get("/orders", orderController_1.getOrders);
router.get("/orders/:id", orderController_1.getOrderById);
router.post("/orders", orderController_1.createOrder);
router.put("/orders/:id/status", orderController_1.updateOrderStatus);
router.post("/orders/:id/cancel", orderController_1.cancelOrder);
exports.default = router;
