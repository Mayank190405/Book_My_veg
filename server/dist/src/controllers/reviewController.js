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
exports.deleteReview = exports.createReview = exports.getProductReviews = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
// Get reviews for a product
const getProductReviews = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const productId = req.params.productId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    try {
        const [reviews, total] = yield prisma_1.default.$transaction([
            prisma_1.default.review.findMany({
                where: { productId, isActive: true },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma_1.default.review.count({ where: { productId, isActive: true } }),
        ]);
        res.json({ reviews, total, page, limit });
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching reviews" });
    }
});
exports.getProductReviews = getProductReviews;
// Create a review
const createReview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId, rating, comment, images } = req.body;
    const userId = req.user.userId;
    try {
        // Optional: Verify purchase
        const hasPurchased = yield prisma_1.default.orderItem.findFirst({
            where: {
                order: { userId, status: "DELIVERED" },
                productId,
            },
        });
        const review = yield prisma_1.default.review.create({
            data: {
                userId,
                productId,
                rating,
                comment,
                images,
                isVerifiedPurchase: !!hasPurchased,
            },
        });
        res.status(201).json(review);
    }
    catch (error) {
        res.status(500).json({ message: "Error creating review" });
    }
});
exports.createReview = createReview;
// Delete review (Admin or owner)
const deleteReview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.params.id;
    const userId = req.user.userId;
    const role = req.user.role;
    try {
        const review = yield prisma_1.default.review.findUnique({ where: { id } });
        if (!review)
            return res.status(404).json({ message: "Review not found" });
        if (review.userId !== userId && role !== "ADMIN") {
            return res.status(403).json({ message: "Not authorized" });
        }
        yield prisma_1.default.review.delete({ where: { id } });
        res.json({ message: "Review deleted" });
    }
    catch (error) {
        res.status(500).json({ message: "Error deleting review" });
    }
});
exports.deleteReview = deleteReview;
