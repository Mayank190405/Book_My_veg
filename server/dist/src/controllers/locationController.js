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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeoSitemapData = exports.deleteLocation = exports.updateLocation = exports.createLocation = exports.getLocationBySlug = exports.getLocations = exports.getLocationById = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getLocationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const location = yield prisma_1.default.location.findUnique({
            where: { id },
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                receiptHeader: true,
                receiptFooter: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true,
                isOpen: true,
                upiId: true
            }
        });
        if (!location)
            return res.status(404).json({ message: "Location not found" });
        res.json(location);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching location" });
    }
});
exports.getLocationById = getLocationById;
const getLocations = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const locations = yield prisma_1.default.location.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                receiptHeader: true,
                receiptFooter: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true,
                isOpen: true,
                upiId: true
            }
        });
        res.status(200).json(locations);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getLocations = getLocations;
const getLocationBySlug = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { slug } = req.params;
        const location = yield prisma_1.default.location.findFirst({
            where: { slug: slug },
            select: {
                id: true,
                slug: true,
                name: true,
                address: true,
                contactNumber: true,
                gstNumber: true,
                receiptHeader: true,
                receiptFooter: true,
                latitude: true,
                longitude: true,
                deliveryRadius: true
            }
        });
        if (!location)
            return res.status(404).json({ message: "Location not found" });
        res.json(location);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching location" });
    }
});
exports.getLocationBySlug = getLocationBySlug;
const createLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const _a = req.body, { name, password } = _a, rest = __rest(_a, ["name", "password"]);
        if (!name)
            return res.status(400).json({ message: "Location name is required" });
        // Generate base slug
        let slug = name.toLowerCase().trim().replace(/[^\w ]+/g, "").replace(/ +/g, "-");
        // Check for collision
        const existing = yield prisma_1.default.location.findFirst({ where: { slug } });
        if (existing) {
            slug = `${slug}-${Math.random().toString(36).substring(7)}`;
        }
        let hashedPassword = undefined;
        if (password) {
            hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        }
        const locationId = req.params.id; // For update logic mostly, but let's focus on create first
        // Data Sanitation & Typal Alignment (Strings to Floats)
        const sanitizedData = {
            address: rest.address || null,
            contactNumber: rest.contactNumber || null,
            gstNumber: rest.gstNumber || null,
            receiptHeader: rest.receiptHeader || null,
            receiptFooter: rest.receiptFooter || null,
            latitude: rest.latitude ? parseFloat(rest.latitude) : null,
            longitude: rest.longitude ? parseFloat(rest.longitude) : null,
            deliveryRadius: rest.deliveryRadius ? parseFloat(rest.deliveryRadius) : 10.0,
        };
        const location = yield prisma_1.default.location.create({
            data: Object.assign(Object.assign({}, sanitizedData), { name,
                slug, password: hashedPassword })
        });
        // Sanitize output
        const { password: _ } = location, sanitized = __rest(location, ["password"]);
        res.status(201).json(sanitized);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createLocation = createLocation;
const updateLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const _a = req.body, { password } = _a, rest = __rest(_a, ["password"]);
        // Data Sanitation & Typal Alignment
        const sanitizedData = Object.assign(Object.assign({}, rest), { latitude: rest.latitude ? parseFloat(rest.latitude) : null, longitude: rest.longitude ? parseFloat(rest.longitude) : null, deliveryRadius: rest.deliveryRadius ? parseFloat(rest.deliveryRadius) : undefined });
        if (password) {
            sanitizedData.password = yield bcryptjs_1.default.hash(password, 10);
        }
        const location = yield prisma_1.default.location.update({
            where: { id },
            data: sanitizedData
        });
        const { password: _ } = location, sanitized = __rest(location, ["password"]);
        res.status(200).json(sanitized);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateLocation = updateLocation;
const deleteLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        yield prisma_1.default.location.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.deleteLocation = deleteLocation;
const getSeoSitemapData = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const locations = yield prisma_1.default.location.findMany({
            select: { id: true, slug: true, name: true, address: true }
        });
        const categories = yield prisma_1.default.category.findMany({
            select: { id: true, slug: true, name: true }
        });
        const products = yield prisma_1.default.product.findMany({
            select: { id: true, name: true, createdAt: true, updatedAt: true }
        });
        const popular = yield prisma_1.default.searchHistory.groupBy({
            by: ["query"],
            _sum: { count: true },
            orderBy: { _sum: { count: "desc" } },
            take: 30,
        });
        let popularSearches = popular.map(p => p.query);
        if (popularSearches.length === 0) {
            popularSearches = ["Organic Potato", "Fresh Onion", "Alphonso Mango", "Mint Leaves", "Green Chili", "Desi Ghee"];
        }
        const addresses = yield prisma_1.default.address.findMany({
            select: { city: true, pincode: true, fullAddress: true }
        });
        // Filter and get distinct pincodes and cities
        const uniqueCities = Array.from(new Set(addresses.map(a => a.city).filter(Boolean)));
        const uniquePincodes = Array.from(new Set(addresses.map(a => a.pincode).filter(Boolean)));
        res.status(200).json({
            locations,
            categories,
            products,
            popularSearches,
            uniqueCities,
            uniquePincodes
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getSeoSitemapData = getSeoSitemapData;
