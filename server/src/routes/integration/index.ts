import { Router } from "express";
import { integrationAuthenticate } from "../../middleware/integrationAuth";
import { integrationThreatDetector } from "../../middleware/integrationThreatDetector";
import { integrationRateLimiter } from "../../middleware/integrationRateLimiter";
import { apiMetricTracker } from "../../middleware/apiMetricTracker";

// Controller imports
import {
    getUsers,
    getUserDetail,
    createUser,
    updateUser
} from "../../controllers/integration/userController";

import {
    getUserAddresses,
    createUserAddress,
    updateUserAddress
} from "../../controllers/integration/addressController";

import {
    getCategories
} from "../../controllers/integration/categoryController";

import {
    getProducts,
    createProduct,
    updateProduct,
    updateInventory,
    updatePricing
} from "../../controllers/integration/productController";

import {
    getLocations,
    getLocationDetail
} from "../../controllers/integration/locationController";

import {
    getOrders,
    getOrderById,
    createOrder,
    updateOrderStatus,
    cancelOrder
} from "../../controllers/integration/orderController";

const router = Router();

// Apply security stack to ALL integration endpoints
router.use(integrationAuthenticate);
router.use(apiMetricTracker);
router.use(integrationThreatDetector);
router.use(integrationRateLimiter);

// ── User API ─────────────────────────────────────────────────────────────────
router.get("/users", getUsers);
router.get("/users/:id", getUserDetail);
router.post("/users", createUser);
router.put("/users/:id", updateUser);

// ── Address API ──────────────────────────────────────────────────────────────
router.get("/addresses/user/:userId", getUserAddresses);
router.post("/addresses/user/:userId", createUserAddress);
router.put("/addresses/:id", updateUserAddress);

// ── Category API ─────────────────────────────────────────────────────────────
router.get("/categories", getCategories);

// ── Product & Variant API ────────────────────────────────────────────────────
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.patch("/products/inventory", updateInventory);
router.post("/products/pricing", updatePricing);

// ── Location API ─────────────────────────────────────────────────────────────
router.get("/locations", getLocations);
router.get("/locations/:id", getLocationDetail);

// ── Order API ────────────────────────────────────────────────────────────────
router.get("/orders", getOrders);
router.get("/orders/:id", getOrderById);
router.post("/orders", createOrder);
router.put("/orders/:id/status", updateOrderStatus);
router.post("/orders/:id/cancel", cancelOrder);

export default router;
