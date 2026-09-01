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
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const authSchemas_1 = require("../schemas/authSchemas");
const prisma_1 = __importDefault(require("../config/prisma"));
const router = (0, express_1.Router)();
router.put("/profile", auth_1.authenticate, (0, validate_1.validate)(authSchemas_1.updateProfileSchema), userController_1.updateProfile);
// GET /api/v1/users — List/search users or customers
router.get("/", auth_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { role, search, query, limit } = req.query;
        const where = {};
        if (role && typeof role === "string") {
            where.role = role;
        }
        const searchQuery = (search || query);
        if (searchQuery && typeof searchQuery === "string" && searchQuery.trim()) {
            const q = searchQuery.trim();
            where.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } }
            ];
        }
        const take = limit ? Math.min(Number(limit), 100) : 50;
        const users = yield prisma_1.default.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                role: true,
                addresses: {
                    where: { isDefault: true },
                    take: 1
                }
            },
            orderBy: { createdAt: "desc" },
            take
        });
        res.json(users);
    }
    catch (err) {
        res.status(500).json({ message: err.message || "Failed to fetch users" });
    }
}));
// Admin Identity Management
router.get("/admin/all", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER"]), userController_1.getUsersAdmin);
router.post("/admin/create", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER"]), userController_1.createUserAdmin);
router.get("/admin/drivers", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), userController_1.getDeliveryPartners);
router.get("/admin/packers", auth_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const packers = yield prisma_1.default.user.findMany({
            where: { role: "PACKING", isActive: true },
            select: { id: true, name: true, phone: true }
        });
        res.json(packers);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to fetch packers" });
    }
}));
router.patch("/admin/update/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER"]), userController_1.updateUserAdmin);
// PATCH /api/v1/users/:id — Update any user's basic info (for POS customer edit)
router.patch("/:id", auth_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, phone, email } = req.body;
        const updated = yield prisma_1.default.user.update({
            where: { id: String(req.params.id) },
            data: Object.assign(Object.assign(Object.assign({}, (name && { name: String(name) })), (phone && { phone: String(phone) })), (email && { email: String(email) })),
            select: { id: true, name: true, phone: true, email: true, role: true }
        });
        res.json(updated);
    }
    catch (err) {
        if (err.code === 'P2025')
            return res.status(404).json({ message: "User not found" });
        res.status(500).json({ message: err.message });
    }
}));
// DELETE /api/v1/users/:id — Delete a user (for POS customer delete)
router.delete("/:id", auth_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma_1.default.user.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    }
    catch (err) {
        if (err.code === 'P2025')
            return res.status(404).json({ message: "User not found" });
        res.status(500).json({ message: err.message });
    }
}));
exports.default = router;
