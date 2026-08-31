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
exports.getPopularSearches = exports.clearSearchHistory = exports.recordSearch = exports.getSearchHistory = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
// Get user search history
const getSearchHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.userId;
    try {
        const history = yield prisma_1.default.searchHistory.findMany({
            where: { userId },
            orderBy: { lastSearchedAt: "desc" },
            take: 10,
        });
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching search history" });
    }
});
exports.getSearchHistory = getSearchHistory;
// Record a search query
const recordSearch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.userId;
    const { query } = req.body;
    if (!query)
        return res.status(400).json({ message: "Query required" });
    try {
        const existing = yield prisma_1.default.searchHistory.findUnique({
            where: { userId_query: { userId, query } },
        });
        if (existing) {
            yield prisma_1.default.searchHistory.update({
                where: { id: existing.id },
                data: {
                    count: { increment: 1 },
                    lastSearchedAt: new Date(),
                },
            });
        }
        else {
            yield prisma_1.default.searchHistory.create({
                data: { userId, query },
            });
        }
        res.status(200).json({ message: "Search recorded" });
    }
    catch (error) {
        res.status(500).json({ message: "Error recording search" });
    }
});
exports.recordSearch = recordSearch;
// Clear history
const clearSearchHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.userId;
    try {
        yield prisma_1.default.searchHistory.deleteMany({ where: { userId } });
        res.json({ message: "Search history cleared" });
    }
    catch (error) {
        res.status(500).json({ message: "Error clearing history" });
    }
});
exports.clearSearchHistory = clearSearchHistory;
const getPopularSearches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const DEFAULT_POPULAR = [
        "Organic Potato",
        "Fresh Onion",
        "Alphonso Mango",
        "Mint Leaves",
        "Green Chili",
        "Desi Ghee",
        "Fresh Tomato",
        "Coriander"
    ];
    try {
        const popular = yield prisma_1.default.searchHistory.findMany({
            orderBy: { count: "desc" },
            take: 10,
            select: { query: true }
        });
        const results = Array.from(new Set(popular.map(p => p.query))).filter(Boolean);
        if (results.length === 0) {
            return res.json(DEFAULT_POPULAR);
        }
        res.json(results);
    }
    catch (error) {
        console.warn("[SearchController] Popular search fallback notice");
        res.json(DEFAULT_POPULAR);
    }
});
exports.getPopularSearches = getPopularSearches;
