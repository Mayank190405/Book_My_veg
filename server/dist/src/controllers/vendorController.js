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
exports.deleteVendor = exports.updateVendor = exports.createVendor = exports.getVendorById = exports.getVendors = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const getVendors = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId, query, category, isActive } = req.query;
    try {
        const whereClause = {};
        if (isActive !== undefined && isActive !== "ALL") {
            whereClause.isActive = isActive === "true";
        }
        if (category && category !== "ALL") {
            whereClause.category = String(category);
        }
        if (locationId && locationId !== "ALL") {
            whereClause.OR = [
                { locationId: String(locationId) },
                { locationId: null }
            ];
        }
        if (query) {
            const q = String(query).trim();
            whereClause.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { companyName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
                { gstNumber: { contains: q, mode: "insensitive" } }
            ];
        }
        const vendors = yield prisma_1.default.vendor.findMany({
            where: whereClause,
            include: {
                location: { select: { id: true, name: true, slug: true } },
                _count: { select: { purchaseOrders: true } }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json({ vendors });
    }
    catch (error) {
        next(error);
    }
});
exports.getVendors = getVendors;
const getVendorById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const vendor = yield prisma_1.default.vendor.findUnique({
            where: { id: String(id) },
            include: {
                location: { select: { id: true, name: true, slug: true } },
                purchaseOrders: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    include: {
                        location: { select: { name: true } },
                        items: {
                            include: {
                                product: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        res.json({ vendor });
    }
    catch (error) {
        next(error);
    }
});
exports.getVendorById = getVendorById;
const createVendor = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, companyName, phone, email, address, gstNumber, paymentTerms, category, locationId } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ message: "Vendor name and phone number are required." });
    }
    try {
        const vendor = yield prisma_1.default.vendor.create({
            data: {
                name: String(name).trim(),
                companyName: companyName ? String(companyName).trim() : null,
                phone: String(phone).trim(),
                email: email ? String(email).trim() : null,
                address: address ? String(address).trim() : null,
                gstNumber: gstNumber ? String(gstNumber).trim() : null,
                paymentTerms: paymentTerms || "NET_30",
                category: category || "VEGETABLES",
                locationId: locationId && locationId !== "GLOBAL" ? String(locationId) : null,
                isActive: true
            },
            include: {
                location: { select: { id: true, name: true } }
            }
        });
        res.status(201).json({ message: "Vendor registered successfully.", vendor });
    }
    catch (error) {
        next(error);
    }
});
exports.createVendor = createVendor;
const updateVendor = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, companyName, phone, email, address, gstNumber, paymentTerms, category, locationId, isActive } = req.body;
    try {
        const vendor = yield prisma_1.default.vendor.update({
            where: { id: String(id) },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (name && { name: String(name).trim() })), (companyName !== undefined && { companyName: companyName ? String(companyName).trim() : null })), (phone && { phone: String(phone).trim() })), (email !== undefined && { email: email ? String(email).trim() : null })), (address !== undefined && { address: address ? String(address).trim() : null })), (gstNumber !== undefined && { gstNumber: gstNumber ? String(gstNumber).trim() : null })), (paymentTerms !== undefined && { paymentTerms })), (category !== undefined && { category })), (locationId !== undefined && { locationId: locationId && locationId !== "GLOBAL" ? String(locationId) : null })), (isActive !== undefined && { isActive: Boolean(isActive) })),
            include: {
                location: { select: { id: true, name: true } }
            }
        });
        res.json({ message: "Vendor updated successfully.", vendor });
    }
    catch (error) {
        next(error);
    }
});
exports.updateVendor = updateVendor;
const deleteVendor = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.vendor.delete({ where: { id: String(id) } });
        res.json({ message: "Vendor deleted successfully." });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteVendor = deleteVendor;
