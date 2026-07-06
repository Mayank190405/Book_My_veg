"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteApiKey = exports.toggleApiKey = exports.listApiKeys = exports.createApiKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../config/prisma"));
const createApiKey = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { name, role, locationId } = req.body;
    if (!name || !role) {
        return res.status(400).json({ message: "Name and role are required." });
    }
    if (role === "STORE_ADMIN" && !locationId) {
        return res.status(400).json({ message: "LocationId is required for store-level keys." });
    }
    try {
        // Enforce store alignment if creator is a store admin
        let targetLocationId = locationId;
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "STORE_ADMIN") {
            const adminLocId = req.user.userId.startsWith("STORE_")
                ? req.user.userId.replace("STORE_", "")
                : (_b = (yield prisma_1.default.user.findUnique({ where: { id: req.user.userId }, select: { locationId: true } }))) === null || _b === void 0 ? void 0 : _b.locationId;
            if (!adminLocId || adminLocId !== locationId) {
                return res.status(403).json({ message: "Store admins can only create keys for their own store location." });
            }
            targetLocationId = adminLocId;
        }
        // Generate high-entropy API key
        const rawKey = "bmv_live_" + crypto_1.default.randomBytes(24).toString("hex");
        const apiKey = yield prisma_1.default.apiKey.create({
            data: {
                name,
                key: rawKey,
                role,
                locationId: role === "STORE_ADMIN" ? targetLocationId : null
            },
            include: {
                location: { select: { name: true } }
            }
        });
        // Return the full unmasked key only ONCE upon creation
        res.status(201).json({
            message: "API Key created successfully. Please save this secret key now, as it will not be shown again.",
            id: apiKey.id,
            name: apiKey.name,
            key: apiKey.key, // Raw unmasked key
            role: apiKey.role,
            locationId: apiKey.locationId,
            locationName: ((_c = apiKey.location) === null || _c === void 0 ? void 0 : _c.name) || "Global / General Admin",
            isActive: apiKey.isActive,
            createdAt: apiKey.createdAt
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createApiKey = createApiKey;
const listApiKeys = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const caller = req.user;
        const where = {};
        // Scope keys listed for Store Admins to their store only
        if ((caller === null || caller === void 0 ? void 0 : caller.role) === "STORE_ADMIN") {
            const adminLocId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId.startsWith("STORE_"))
                ? req.user.userId.replace("STORE_", "")
                : (_c = (yield prisma_1.default.user.findUnique({ where: { id: (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId }, select: { locationId: true } }))) === null || _c === void 0 ? void 0 : _c.locationId;
            if (adminLocId) {
                where.locationId = adminLocId;
            }
            else {
                return res.json([]);
            }
        }
        const keys = yield prisma_1.default.apiKey.findMany({
            where,
            include: {
                location: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });
        // Mask secrets to prevent unauthorized leakage in list views
        const maskedKeys = keys.map(key => {
            var _a;
            return ({
                id: key.id,
                name: key.name,
                key: `bmv_live_****************${key.key.substring(key.key.length - 4)}`, // masked
                role: key.role,
                locationId: key.locationId,
                locationName: ((_a = key.location) === null || _a === void 0 ? void 0 : _a.name) || "Global / General Admin",
                isActive: key.isActive,
                isSuspended: key.isSuspended,
                suspendReason: key.suspendReason,
                createdAt: key.createdAt,
                updatedAt: key.updatedAt
            });
        });
        res.json(maskedKeys);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.listApiKeys = listApiKeys;
const toggleApiKey = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const id = req.params.id;
    const { isActive } = req.body;
    if (isActive === undefined) {
        return res.status(400).json({ message: "isActive status is required." });
    }
    try {
        const key = yield prisma_1.default.apiKey.findUnique({ where: { id } });
        if (!key) {
            return res.status(404).json({ message: "API key not found." });
        }
        // Store Admins sovereignty check
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "STORE_ADMIN") {
            const adminLocId = req.user.userId.startsWith("STORE_")
                ? req.user.userId.replace("STORE_", "")
                : (_b = (yield prisma_1.default.user.findUnique({ where: { id: req.user.userId }, select: { locationId: true } }))) === null || _b === void 0 ? void 0 : _b.locationId;
            if (!adminLocId || adminLocId !== key.locationId) {
                return res.status(403).json({ message: "Store admins are restricted to managing local store API keys only." });
            }
        }
        // Update active status, and if activating, clear suspension status to allow recovery!
        const updated = yield prisma_1.default.apiKey.update({
            where: { id },
            data: Object.assign({ isActive }, (isActive && { isSuspended: false, suspendReason: null }))
        });
        res.json({
            message: `API key ${isActive ? "activated" : "deactivated"} successfully.`,
            id: updated.id,
            isActive: updated.isActive,
            isSuspended: updated.isSuspended
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.toggleApiKey = toggleApiKey;
const deleteApiKey = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const id = req.params.id;
    try {
        const key = yield prisma_1.default.apiKey.findUnique({ where: { id } });
        if (!key) {
            return res.status(404).json({ message: "API key not found." });
        }
        // Store Admins sovereignty check
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "STORE_ADMIN") {
            const adminLocId = req.user.userId.startsWith("STORE_")
                ? req.user.userId.replace("STORE_", "")
                : (_b = (yield prisma_1.default.user.findUnique({ where: { id: req.user.userId }, select: { locationId: true } }))) === null || _b === void 0 ? void 0 : _b.locationId;
            if (!adminLocId || adminLocId !== key.locationId) {
                return res.status(403).json({ message: "Store admins are restricted to managing local store API keys only." });
            }
        }
        yield prisma_1.default.apiKey.delete({ where: { id } });
        res.json({ message: "API key deleted successfully." });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.deleteApiKey = deleteApiKey;
