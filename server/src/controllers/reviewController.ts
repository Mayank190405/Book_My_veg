import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

// Get reviews for a product
export const getProductReviews = async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const [reviews, total] = await prisma.$transaction([
            prisma.review.findMany({
                where: { productId, isActive: true },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.review.count({ where: { productId, isActive: true } }),
        ]);

        res.json({ reviews, total, page, limit });
    } catch (error) {
        res.status(500).json({ message: "Error fetching reviews" });
    }
};

// Create a review
export const createReview = async (req: AuthRequest, res: Response) => {
    const { productId, rating, comment, images } = req.body;
    const userId = req.user!.userId;

    try {
        // Optional: Verify purchase
        const hasPurchased = await prisma.orderItem.findFirst({
            where: {
                order: { userId, status: "DELIVERED" },
                productId,
            },
        });

        const review = await prisma.review.create({
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
    } catch (error) {
        res.status(500).json({ message: "Error creating review" });
    }
};

// Delete review (Admin or owner)
export const deleteReview = async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const role = req.user!.role;

    try {
        const review = await prisma.review.findUnique({ where: { id } });
        if (!review) return res.status(404).json({ message: "Review not found" });

        if (review.userId !== userId && role !== "ADMIN") {
            return res.status(403).json({ message: "Not authorized" });
        }

        await prisma.review.delete({ where: { id } });
        res.json({ message: "Review deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting review" });
    }
};
