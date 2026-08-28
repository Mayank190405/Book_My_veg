import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

// Get user search history
export const getSearchHistory = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    try {
        const history = await prisma.searchHistory.findMany({
            where: { userId },
            orderBy: { lastSearchedAt: "desc" },
            take: 10,
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: "Error fetching search history" });
    }
};

// Record a search query
export const recordSearch = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { query } = req.body;

    if (!query) return res.status(400).json({ message: "Query required" });

    try {
        const existing = await prisma.searchHistory.findUnique({
            where: { userId_query: { userId, query } },
        });

        if (existing) {
            await prisma.searchHistory.update({
                where: { id: existing.id },
                data: {
                    count: { increment: 1 },
                    lastSearchedAt: new Date(),
                },
            });
        } else {
            await prisma.searchHistory.create({
                data: { userId, query },
            });
        }
        res.status(200).json({ message: "Search recorded" });
    } catch (error) {
        res.status(500).json({ message: "Error recording search" });
    }
};

// Clear history
export const clearSearchHistory = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    try {
        await prisma.searchHistory.deleteMany({ where: { userId } });
        res.json({ message: "Search history cleared" });
    } catch (error) {
        res.status(500).json({ message: "Error clearing history" });
    }
};

export const getPopularSearches = async (req: Request, res: Response) => {
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
        const popular = await prisma.searchHistory.findMany({
            orderBy: { count: "desc" },
            take: 10,
            select: { query: true }
        });

        const results = Array.from(new Set(popular.map(p => p.query))).filter(Boolean);
        if (results.length === 0) {
            return res.json(DEFAULT_POPULAR);
        }
        res.json(results);
    } catch (error) {
        console.warn("[SearchController] Popular search fallback notice");
        res.json(DEFAULT_POPULAR);
    }
};
