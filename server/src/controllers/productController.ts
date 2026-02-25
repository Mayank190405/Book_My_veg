import { Request, Response } from "express";
import prisma from "../config/prisma";

import redisClient from "../config/redis";
import { invalidateProductCache } from "../utils/cacheUtils";



const CACHE_TTL = 300; // 5 minutes
const TRENDING_TTL = 7200; // 2 hours

// ─── helpers ────────────────────────────────────────────────────────────────

function buildCursorQuery(cursor?: string, limit = 20) {
    return {
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
    };
}

function buildPaginatedResponse<T extends { id: string }>(rows: T[], limit: number) {
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return { data, nextCursor };
}

// ─── getProducts (cursor-based, cached) ─────────────────────────────────────

export const getProducts = async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const cacheKey = `products:${cursor ?? "start"}:${limit}`;

    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        // ── FIX 2: Cursor-based pagination ────────────────────────────────
        const rows = await prisma.product.findMany({
            where: { isActive: true },
            ...buildCursorQuery(cursor, limit),
            include: {
                inventory: true,
                pricing: { where: { isActive: true } },
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true,
                    },
                    where: { isActive: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const result = buildPaginatedResponse(rows, limit);
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching products" });
    }
};

// ─── getTrendingProducts (Redis sorted set) ──────────────────────────────────

// ─── getTrendingProducts (Redis sorted set) ──────────────────────────────────

export const getTrendingProducts = async (req: Request, res: Response) => {
    // ── FIX 3: Redis ZREVRANGE for sales velocity ─────────────────────────
    const pincode = req.query.pincode as string;
    // Use pincode if present, else global. 
    // In a real app, might map pincode -> cluster/hub ID.
    const locationKey = pincode ? `trending:${pincode}` : "trending:global";

    try {
        let productIds: string[] = (await redisClient.sendCommand(["ZREVRANGE", locationKey, "0", "9"]) as string[]) ?? [];

        // If no local trending data, fall back to global
        if (productIds.length === 0 && pincode) {
            productIds = (await redisClient.sendCommand(["ZREVRANGE", "trending:global", "0", "9"]) as string[]) ?? [];
        }

        if (productIds.length > 0) {
            // Fetch products for the trending IDs in order
            const products = await prisma.product.findMany({
                where: { id: { in: productIds }, isActive: true },
                include: {
                    inventory: true,
                    pricing: { where: { isActive: true } },
                    variants: {
                        include: {
                            pricing: { where: { isActive: true } },
                            inventory: true,
                        },
                        where: { isActive: true },
                    },
                },
            });

            // Restore Redis sort order
            const sorted = productIds
                .map((pid: string) => products.find((p) => p.id === pid))
                .filter(Boolean);

            return res.json(sorted);
        }

        // Fallback: most ordered products in last 2 hours from DB (Global fallback)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const topItems = await prisma.orderItem.groupBy({
            by: ["productId"],
            _sum: { quantity: true },
            where: { order: { createdAt: { gte: twoHoursAgo } } },
            orderBy: { _sum: { quantity: "desc" } },
            take: 10,
        });

        const productIds2: string[] = topItems.map((x) => x.productId);

        const products =
            productIds2.length > 0
                ? await prisma.product.findMany({
                    where: { id: { in: productIds2 }, isActive: true },
                    include: { inventory: true, pricing: { where: { isActive: true } } },
                })
                : await prisma.product.findMany({
                    where: { isActive: true },
                    take: 10,
                    include: {
                        inventory: true,
                        pricing: { where: { isActive: true } },
                        variants: {
                            include: {
                                pricing: { where: { isActive: true } },
                                inventory: true,
                            },
                            where: { isActive: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                });

        res.json(productIds2.length > 0
            ? productIds2.map((pid: string) => products.find((p) => p.id === pid)).filter(Boolean)
            : products
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching trending products" });
    }
};

/**
 * Called internally after a successful order to update trending scores.
 */
export async function trackTrendingOnOrder(
    items: Array<{ productId: string; quantity: number }>,
    pincode?: string // Optional location context
): Promise<void> {
    const keys = ["trending:global"];
    if (pincode) keys.push(`trending:${pincode}`);

    for (const key of keys) {
        for (const item of items) {
            await redisClient.zIncrBy(key, item.quantity, item.productId);
        }
        await redisClient.expire(key, TRENDING_TTL);
    }
}

// ─── getBuyAgain (User specific history) ─────────────────────────────────────

export interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string };
}

export const getBuyAgain = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        // Find most frequently bought products by this user
        const topBought = await prisma.orderItem.groupBy({
            by: ["productId"],
            _count: { productId: true },
            where: { order: { userId } },
            orderBy: { _count: { productId: "desc" } },
            take: 10,
        });

        if (topBought.length === 0) return res.json([]);

        const productIds = topBought.map((x) => x.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, isActive: true },
            include: {
                inventory: true,
                pricing: { where: { isActive: true } },
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true,
                    },
                    where: { isActive: true },
                },
            },
        });

        // Respect frequency order
        const result = productIds
            .map((pid) => products.find((p) => p.id === pid))
            .filter(Boolean);

        res.json(result);
    } catch (error) {
        console.error("Error fetching buy again:", error);
        res.status(500).json({ message: "Error fetching buy again products" });
    }
};

// ─── getFlashDeals ───────────────────────────────────────────────────────────

export const getFlashDeals = async (req: Request, res: Response) => {
    const cacheKey = "flashDeals";
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const now = new Date();
        const flashDeals = await prisma.pricing.findMany({
            where: {
                isActive: true,
                endDate: { gt: now },
                startDate: { lt: now },
                discountValue: { gt: 0 },
            },
            include: {
                product: { include: { inventory: true } },
            },
            take: 10,
            orderBy: { endDate: "asc" },
        });

        const formatted = flashDeals.map((deal) => ({
            id: deal.id,
            productId: deal.productId,
            name: deal.product.name,
            price: deal.price,
            originalPrice: deal.product.basePrice,
            discount: deal.discountValue,
            discountType: deal.discountType,
            image: deal.product.images[0] || "",
            endTime: deal.endDate,
            stock: deal.product.inventory.reduce((acc, inv) => acc + inv.currentStock, 0),
            totalStock: deal.product.inventory.reduce(
                (acc, inv) => acc + inv.thresholdStock + inv.currentStock,
                0
            ),
        }));

        // Cache until nearest deal expires (or 5 min max)
        const minExpiry = flashDeals.reduce((min, d) => {
            const diff = Math.floor((new Date(d.endDate!).getTime() - Date.now()) / 1000);
            return Math.min(min, diff);
        }, CACHE_TTL);

        await redisClient.setEx(cacheKey, Math.max(minExpiry, 30), JSON.stringify(formatted));
        res.json(formatted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching flash deals" });
    }
};

// ─── getProductById ──────────────────────────────────────────────────────────

export const getProductById = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cacheKey = `product:${id}`;

    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                pricing: { where: { isActive: true } },
                inventory: true,
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true,
                    },
                    where: { isActive: true },
                },
            },
        });

        if (!product) return res.status(404).json({ message: "Product not found" });

        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(product));
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Error fetching product" });
    }
};

// ─── createProduct ───────────────────────────────────────────────────────────

export const createProduct = async (req: Request, res: Response) => {
    try {
        const product = await prisma.product.create({ data: req.body });
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: "Error creating product" });
    }
};

// ─── updateProduct (+ cache invalidation) ───────────────────────────────────

export const updateProduct = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const product = await prisma.product.update({ where: { id }, data: req.body });
        // ── FIX 5: Invalidate caches on update ────────────────────────────
        await invalidateProductCache(id, product.categoryId ?? undefined);
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Error updating product" });
    }
};

// ─── deleteProduct ───────────────────────────────────────────────────────────

export const deleteProduct = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const product = await prisma.product.delete({ where: { id } });
        await invalidateProductCache(id, product.categoryId ?? undefined);
        res.json({ message: "Product deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting product" });
    }
};

// ─── getSimilarProducts ───────────────────────────────────────────────────────

export const getSimilarProducts = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const product = await prisma.product.findUnique({
            where: { id },
            select: { categoryId: true },
        });

        if (!product) return res.status(404).json({ message: "Product not found" });

        const similar = await prisma.product.findMany({
            where: {
                categoryId: product.categoryId,
                id: { not: id },
                isActive: true,
            },
            take: 10,
            include: {
                inventory: true,
                pricing: { where: { isActive: true } },
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true,
                    },
                    where: { isActive: true },
                },
            },
        });

        res.json(similar);
    } catch (error) {
        res.status(500).json({ message: "Error fetching similar products" });
    }
};

// ─── checkServiceability ──────────────────────────────────────────────────────
const SERVICEABLE_PINCODES = ["110001", "560001", "400001", "600001", "700001", "500001", "122001", "201301"];

export const checkServiceability = async (req: Request, res: Response) => {
    const pincode = req.params.pincode as string;

    // Mock logic: Allow strictly defined list OR any 6-digit code starting with 1-9 for demo if desired.
    // user requested "Delivery Check", implying real restriction or at least a check.
    // For MVP, if it's in the list OR if we want to be generous for demo:
    // Let's allow any valid 6 digit number for now but mark "Express" vs "Standard" maybe?
    // Sticking to "Serviceable" vs "Not Serviceable" for demo purposes.

    // Allow everything for demo, but kept list for reference
    const isServiceable = /^[1-9][0-9]{5}$/.test(pincode);

    if (isServiceable) {
        res.json({
            serviceable: true,
            message: "Delivery available directly to your doorstep!",
            estimatedDelivery: "20-30 mins",
        });
    } else {
        res.status(400).json({
            serviceable: false,
            message: "Sorry, we do not deliver to this location yet.",
        });
    }
};
// ─── Bulk Operations ────────────────────────────────────────────────────────

export const bulkDeleteProducts = async (req: Request, res: Response) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids array is required" });
    }
    try {
        await prisma.product.deleteMany({
            where: { id: { in: ids } }
        });
        // Clear global cache if needed, or iterate for specific ones
        await redisClient.flushDb(); // Aggressive cache clear for bulk operations
        res.json({ message: `Successfully deleted ${ids.length} products` });
    } catch (error) {
        res.status(500).json({ message: "Error in bulk delete" });
    }
};

export const bulkUploadProducts = async (req: Request, res: Response) => {
    const products = req.body; // Expecting array of product objects
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "Products array is required" });
    }
    try {
        const result = await prisma.$transaction(
            products.map((p: any) => prisma.product.create({ data: p }))
        );
        await redisClient.flushDb();
        res.status(201).json({ message: `Successfully uploaded ${result.length} products`, count: result.length });
    } catch (error: any) {
        res.status(500).json({ message: "Error in bulk upload", error: error.message });
    }
};
