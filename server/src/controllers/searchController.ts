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

// Get popular searches (aggregated) - basic implementation
// Ideally this would be cached or use Redis for heavy load
export const getPopularSearches = async (req: Request, res: Response) => {
    try {
        // Simple distinct aggregation for MVP
        // In real app, use Redis sorted set
        const popular = await prisma.searchHistory.groupBy({
            by: ["query"],
            _sum: { count: true },
            orderBy: { _sum: { count: "desc" } },
            take: 10,
        });

        // Map to simple array of strings
        const results = popular.map(p => p.query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: "Error fetching popular searches" });
    }
};
