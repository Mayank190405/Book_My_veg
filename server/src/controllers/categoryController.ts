import { Request, Response } from "express";
import prisma from "../config/prisma";

import redisClient from "../config/redis";
import { invalidateCategoryCache } from "../utils/cacheUtils";


const CACHE_TTL = 300; // 5 minutes

// ─── getCategories (cached) ──────────────────────────────────────────────────

export const getCategories = async (req: Request, res: Response) => {
    const cacheKey = "categories:all";
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const categories = await prisma.category.findMany({
            where: { isActive: true, parentId: null },
            include: { children: true },
            orderBy: { sortOrder: "asc" },
        });

        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(categories));
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: "Error fetching categories" });
    }
};

// ─── getCategoryById (cursor-based products, cached) ─────────────────────────

export const getCategoryById = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    // ── FIX 2: Cursor pagination for category products ────────────────────
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const cacheKey = `category:${id}:${cursor ?? "start"}:${limit}`;

    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const category = await prisma.category.findUnique({
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
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!category) return res.status(404).json({ message: "Category not found" });

        // Build cursor response
        const allProducts = Array.isArray(category.products) ? category.products : [];
        const hasMore = allProducts.length > limit;
        const products = hasMore ? allProducts.slice(0, limit) : allProducts;
        const nextCursor = hasMore ? products[products.length - 1].id : null;

        const result = { ...category, products: products as any[], nextCursor };
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error fetching category" });
    }
};

// ─── createCategory ──────────────────────────────────────────────────────────

export const createCategory = async (req: Request, res: Response) => {
    try {
        const category = await prisma.category.create({ data: req.body });
        // Invalidate list cache
        await redisClient.del("categories:all");
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: "Error creating category" });
    }
};

// ─── updateCategory (+ cache invalidation) ───────────────────────────────────

export const updateCategory = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const category = await prisma.category.update({ where: { id }, data: req.body });
        // ── FIX 5: Invalidate on update ───────────────────────────────────
        await Promise.all([
            invalidateCategoryCache(id),
            redisClient.del("categories:all"),
        ]);
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: "Error updating category" });
    }
};

// ─── deleteCategory ───────────────────────────────────────────────────────────

export const deleteCategory = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.category.delete({ where: { id } });
        await Promise.all([
            invalidateCategoryCache(id),
            redisClient.del("categories:all"),
        ]);
        res.json({ message: "Category deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting category" });
    }
};

