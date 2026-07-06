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
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryById = exports.getCategories = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const redis_1 = __importDefault(require("../config/redis"));
const cacheUtils_1 = require("../utils/cacheUtils");
const CACHE_TTL = 300; // 5 minutes
// ─── getCategories (cached) ──────────────────────────────────────────────────
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = "categories:all";
    try {
        const cached = yield redis_1.default.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        const categories = yield prisma_1.default.category.findMany({
            where: { isActive: true, parentId: null },
            include: { children: true },
            orderBy: { sortOrder: "asc" },
        });
        yield redis_1.default.setEx(cacheKey, CACHE_TTL, JSON.stringify(categories));
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching categories" });
    }
});
exports.getCategories = getCategories;
// ─── getCategoryById (cursor-based products, cached) ─────────────────────────
const getCategoryById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.params.id;
    // ── FIX 2: Cursor pagination for category products ────────────────────
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const cursor = req.query.cursor;
    const cacheKey = `category:${id}:${cursor !== null && cursor !== void 0 ? cursor : "start"}:${limit}`;
    try {
        const cached = yield redis_1.default.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        const category = yield prisma_1.default.category.findUnique({
            where: { id },
            include: {
                children: true,
                products: {
                    where: { isActive: true },
                    take: limit + 1,
                    cursor: cursor ? { id: cursor } : undefined,
                    skip: cursor ? 1 : 0,
                    include: {
                        inventory: true,
                        pricing: { where: { isActive: true } },
                        variants: {
                            include: {
                                pricing: { where: { isActive: true } },
                                inventory: true
                            }
                        }
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!category)
            return res.status(404).json({ message: "Category not found" });
        // Build cursor response
        const allProducts = Array.isArray(category.products) ? category.products : [];
        const hasMore = allProducts.length > limit;
        const products = hasMore ? allProducts.slice(0, limit) : allProducts;
        const nextCursor = hasMore ? products[products.length - 1].id : null;
        const result = Object.assign(Object.assign({}, category), { products: products, nextCursor });
        yield redis_1.default.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching category" });
    }
});
exports.getCategoryById = getCategoryById;
// ─── createCategory ──────────────────────────────────────────────────────────
const createCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, slug, icon, imageUrl, isActive, sortOrder, parentId } = req.body;
        const category = yield prisma_1.default.category.create({
            data: {
                name,
                slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                icon,
                imageUrl,
                isActive: isActive !== undefined ? isActive : true,
                sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
                parentId: parentId || null
            }
        });
        // Invalidate list cache
        yield redis_1.default.del("categories:all");
        res.status(201).json(category);
    }
    catch (error) {
        res.status(500).json({ message: "Error creating category" });
    }
});
exports.createCategory = createCategory;
// ─── updateCategory (+ cache invalidation) ───────────────────────────────────
const updateCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.params.id;
    try {
        const { name, slug, icon, imageUrl, isActive, sortOrder, parentId } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (slug !== undefined)
            updateData.slug = slug;
        if (icon !== undefined)
            updateData.icon = icon;
        if (imageUrl !== undefined)
            updateData.imageUrl = imageUrl;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (sortOrder !== undefined)
            updateData.sortOrder = Number(sortOrder);
        if (parentId !== undefined)
            updateData.parentId = parentId || null;
        const category = yield prisma_1.default.category.update({ where: { id }, data: updateData });
        // ── FIX 5: Invalidate on update ───────────────────────────────────
        yield Promise.all([
            (0, cacheUtils_1.invalidateCategoryCache)(id),
            redis_1.default.del("categories:all"),
        ]);
        res.json(category);
    }
    catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Category not found" });
        }
        res.status(500).json({ message: "Error updating category" });
    }
});
exports.updateCategory = updateCategory;
// ─── deleteCategory ───────────────────────────────────────────────────────────
const deleteCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.params.id;
    try {
        yield prisma_1.default.category.delete({ where: { id } });
        yield Promise.all([
            (0, cacheUtils_1.invalidateCategoryCache)(id),
            redis_1.default.del("categories:all"),
        ]);
        res.json({ message: "Category deleted" });
    }
    catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Category not found" });
        }
        res.status(500).json({ message: "Error deleting category" });
    }
});
exports.deleteCategory = deleteCategory;
