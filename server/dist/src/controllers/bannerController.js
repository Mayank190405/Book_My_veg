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
exports.toggleBanner = exports.deleteBanner = exports.updateBanner = exports.createBanner = exports.getBanners = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const getBanners = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const banners = yield prisma_1.default.banner.findMany({
            orderBy: { sortOrder: "asc" }
        });
        res.json(banners);
    }
    catch (error) {
        next(error);
    }
});
exports.getBanners = getBanners;
const createBanner = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, subtitle, imageUrl, link, isActive, sortOrder, redirectType, redirectId, buttonText, priority, position } = req.body;
        if (isActive) {
            const activeCount = yield prisma_1.default.banner.count({ where: { isActive: true } });
            if (activeCount >= 3) {
                return res.status(400).json({ message: "Maximum of 3 active banners allowed" });
            }
        }
        const banner = yield prisma_1.default.banner.create({
            data: {
                title,
                subtitle,
                imageUrl,
                link,
                isActive: isActive !== null && isActive !== void 0 ? isActive : true,
                sortOrder: sortOrder || 0,
                redirectType: redirectType || "external",
                redirectId,
                buttonText,
                priority: priority || 0,
                position: position || "HOME_TOP"
            }
        });
        res.status(201).json(banner);
    }
    catch (error) {
        next(error);
    }
});
exports.createBanner = createBanner;
const updateBanner = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const { title, subtitle, imageUrl, link, isActive, sortOrder, redirectType, redirectId, buttonText, priority, position } = req.body;
        if (isActive) {
            const activeCount = yield prisma_1.default.banner.count({
                where: {
                    isActive: true,
                    id: { not: id }
                }
            });
            if (activeCount >= 3) {
                return res.status(400).json({ message: "Maximum of 3 active banners allowed" });
            }
        }
        const banner = yield prisma_1.default.banner.update({
            where: { id },
            data: {
                title,
                subtitle,
                imageUrl,
                link,
                isActive,
                sortOrder,
                redirectType,
                redirectId,
                buttonText,
                priority,
                position
            }
        });
        res.json(banner);
    }
    catch (error) {
        next(error);
    }
});
exports.updateBanner = updateBanner;
const deleteBanner = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        yield prisma_1.default.banner.delete({ where: { id } });
        res.json({ message: "Banner deleted" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteBanner = deleteBanner;
const toggleBanner = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const existing = yield prisma_1.default.banner.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: "Banner not found" });
        const newState = !existing.isActive;
        if (newState) {
            const activeCount = yield prisma_1.default.banner.count({ where: { isActive: true } });
            if (activeCount >= 3) {
                return res.status(400).json({ message: "Maximum of 3 active banners allowed" });
            }
        }
        const banner = yield prisma_1.default.banner.update({
            where: { id },
            data: { isActive: newState }
        });
        res.json(banner);
    }
    catch (error) {
        next(error);
    }
});
exports.toggleBanner = toggleBanner;
