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
exports.getLocationDetail = exports.getLocations = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const integrationThreatDetector_1 = require("../../middleware/integrationThreatDetector");
const getLocations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    const where = { isOpen: true };
    // Scope store list for store-level API keys
    if (integration.role === "STORE_ADMIN") {
        if (integration.locationId) {
            where.id = integration.locationId;
        }
        else {
            return res.json([]);
        }
    }
    try {
        const locations = yield prisma_1.default.location.findMany({
            where,
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true,
                isOpen: true
            }
        });
        res.json(locations);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getLocations = getLocations;
const getLocationDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const integration = req.integration;
    // Store boundary check
    if (integration.role === "STORE_ADMIN" && integration.locationId !== id) {
        yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
        return res.status(403).json({ message: "Forbidden. Store access mismatch." });
    }
    try {
        const location = yield prisma_1.default.location.findUnique({
            where: { id },
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true,
                isOpen: true
            }
        });
        if (!location) {
            return res.status(404).json({ message: "Location not found." });
        }
        res.json(location);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getLocationDetail = getLocationDetail;
