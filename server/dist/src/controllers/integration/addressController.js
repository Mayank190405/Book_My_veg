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
exports.updateUserAddress = exports.createUserAddress = exports.getUserAddresses = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const integrationThreatDetector_1 = require("../../middleware/integrationThreatDetector");
const getUserAddresses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const integration = req.integration;
    try {
        // Fetch target user location boundary
        const targetUser = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { locationId: true }
        });
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }
        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && targetUser.locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. User store alignment mismatch." });
        }
        const addresses = yield prisma_1.default.address.findMany({
            where: { userId },
            orderBy: { isDefault: "desc" }
        });
        res.json(addresses);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getUserAddresses = getUserAddresses;
const createUserAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { type, fullAddress, landmark, city, state, pincode, name, phone, latitude, longitude, isDefault } = req.body;
    const integration = req.integration;
    if (!fullAddress) {
        return res.status(400).json({ message: "fullAddress is required." });
    }
    try {
        const targetUser = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { locationId: true }
        });
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }
        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && targetUser.locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. User store alignment mismatch." });
        }
        // If setting as default, unset other default addresses for this user
        if (isDefault) {
            yield prisma_1.default.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }
        const address = yield prisma_1.default.address.create({
            data: {
                userId,
                type: type || "HOME",
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                isDefault: !!isDefault,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });
        res.status(201).json(address);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createUserAddress = createUserAddress;
const updateUserAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { type, fullAddress, landmark, city, state, pincode, name, phone, latitude, longitude, isDefault } = req.body;
    const integration = req.integration;
    try {
        const address = yield prisma_1.default.address.findUnique({
            where: { id },
            include: { user: { select: { id: true, locationId: true } } }
        });
        if (!address) {
            return res.status(404).json({ message: "Address not found." });
        }
        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && address.user.locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Address belongs to user in another store boundary." });
        }
        if (isDefault) {
            yield prisma_1.default.address.updateMany({
                where: { userId: address.userId, isDefault: true },
                data: { isDefault: false }
            });
        }
        const updated = yield prisma_1.default.address.update({
            where: { id },
            data: {
                type,
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : undefined,
                longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : undefined,
                isDefault: isDefault !== undefined ? !!isDefault : undefined,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateUserAddress = updateUserAddress;
