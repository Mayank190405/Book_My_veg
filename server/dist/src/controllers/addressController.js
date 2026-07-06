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
exports.deleteAddress = exports.updateAddress = exports.createAddress = exports.getAddresses = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const getAddresses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const addresses = yield prisma_1.default.address.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' } // Default address first
        });
        res.json(addresses);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching addresses" });
    }
});
exports.getAddresses = getAddresses;
const createAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    // Expanded fields based on new schema
    const { type, fullAddress, landmark, city, state, pincode, name, phone, latitude, longitude, isDefault } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        // If setting as default, unset other default addresses
        if (isDefault) {
            yield prisma_1.default.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }
        const address = yield prisma_1.default.address.create({
            data: {
                userId,
                type,
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude,
                longitude,
                isDefault,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });
        res.status(201).json(address);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating address" });
    }
});
exports.createAddress = createAddress;
const updateAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { id } = req.params;
    const { type, fullAddress, landmark, city, state, pincode, name, phone, latitude, longitude, isDefault } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        if (isDefault) {
            yield prisma_1.default.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }
        const address = yield prisma_1.default.address.update({
            where: { id: id, userId },
            data: {
                type,
                fullAddress,
                landmark,
                city,
                state,
                pincode,
                name,
                phone,
                latitude,
                longitude,
                isDefault,
                tag: type === "OTHER" ? "Other" : type === "HOME" ? "Home" : "Office"
            }
        });
        res.json(address);
    }
    catch (error) {
        res.status(500).json({ message: "Error updating address" });
    }
});
exports.updateAddress = updateAddress;
const deleteAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { id } = req.params;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        yield prisma_1.default.address.delete({
            where: { id: id, userId }
        });
        res.json({ message: "Address deleted" });
    }
    catch (error) {
        res.status(500).json({ message: "Error deleting address" });
    }
});
exports.deleteAddress = deleteAddress;
