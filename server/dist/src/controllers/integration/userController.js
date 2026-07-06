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
exports.updateUser = exports.createUser = exports.getUserDetail = exports.getUsers = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const integrationThreatDetector_1 = require("../../middleware/integrationThreatDetector");
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    const { limit = 20, cursor } = req.query;
    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const where = {};
    // Store-level API Key isolation check
    if (integration.role === "STORE_ADMIN") {
        if (integration.locationId) {
            where.locationId = integration.locationId;
        }
        else {
            return res.json({ data: [], nextCursor: null });
        }
    }
    try {
        const users = yield prisma_1.default.user.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: "desc" }
        });
        const hasMore = users.length > parsedLimit;
        const data = hasMore ? users.slice(0, parsedLimit) : users;
        const nextCursor = hasMore ? data[data.length - 1].id : null;
        // Log record consumption volume
        yield (0, integrationThreatDetector_1.logDataHarvest)(req, data.length);
        res.json({ data, nextCursor });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getUsers = getUsers;
const getUserDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const integration = req.integration;
    try {
        const user = yield prisma_1.default.user.findUnique({
            where: { id },
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                createdAt: true,
                updatedAt: true,
                addresses: true
            }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && user.locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Store access mismatch." });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getUserDetail = getUserDetail;
const createUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone, name, email, role, locationId, password } = req.body;
    const integration = req.integration;
    if (!phone) {
        return res.status(400).json({ message: "Phone is required." });
    }
    // Align location for store-level API keys
    let targetLocationId = locationId;
    if (integration.role === "STORE_ADMIN") {
        if (locationId && locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Store admins can only onboard local store staff." });
        }
        targetLocationId = integration.locationId;
    }
    try {
        const hashedPassword = password ? yield bcryptjs_1.default.hash(password, 10) : yield bcryptjs_1.default.hash("user123", 10);
        const user = yield prisma_1.default.user.create({
            data: {
                phone: phone.toString(),
                name,
                email,
                role: role || "USER",
                locationId: targetLocationId,
                password: hashedPassword,
                isActive: true
            },
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                createdAt: true
            }
        });
        res.status(201).json(user);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Phone number or email is already registered." });
        }
        res.status(500).json({ error: error.message });
    }
});
exports.createUser = createUser;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, email, role, locationId, isActive, password } = req.body;
    const integration = req.integration;
    try {
        const targetUser = yield prisma_1.default.user.findUnique({ where: { id } });
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }
        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && targetUser.locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Store access mismatch." });
        }
        // Prevent location modification for store admins
        if (integration.role === "STORE_ADMIN" && locationId && locationId !== integration.locationId) {
            return res.status(403).json({ message: "Forbidden. Cannot move user to another store location." });
        }
        const hashedPassword = password ? yield bcryptjs_1.default.hash(password, 10) : undefined;
        const updatedUser = yield prisma_1.default.user.update({
            where: { id },
            data: Object.assign({ name,
                email,
                role, locationId: integration.role === "STORE_ADMIN" ? targetUser.locationId : locationId, isActive }, (hashedPassword && { password: hashedPassword })),
            select: {
                id: true,
                phone: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                locationId: true,
                updatedAt: true
            }
        });
        res.json(updatedUser);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateUser = updateUser;
