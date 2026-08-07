import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";
import redisClient from "../config/redis";
import { invalidateProductCache } from "../utils/cacheUtils";
import { SearchService } from "../services/searchService";
import csv from "csv-parser";
import fs from "fs";

const CACHE_TTL = 300; // 5 minutes
const TRENDING_TTL = 7200; // 2 hours

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeWeightUnit(unit: string): any {
    if (!unit) return "GM";
    const u = unit.trim().toUpperCase();
    const result = u === "G" || u === "GM" || u === "GRAM" || u === "GRAMS" ? "GM" :
           u === "KG" || u === "KILOGRAM" || u === "KILOGRAMS" ? "KG" :
           u === "ML" || u === "MILLILITER" ? "ML" :
           u === "LTR" || u === "LITER" || u === "LITRE" ? "LTR" :
           u === "PKT" || u === "PACKET" || u === "PACKETS" || u === "PKTS" ? "PACKET" :
           u === "PIECE" || u === "PCS" || u === "PC" || u === "PIECES" ? "PIECE" : "GM";
    
    if (unit && result === "GM" && u !== "GM" && u !== "GRAM") {
        console.log(`[Normalization] Unit "${unit}" fell back to GM`);
    }
    return result;
}

// ─── Product Controller Logic ───────────────────────────────────────────────

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { categoryId, search, cursor, limit = "20", locationId } = req.query;
        const pageLimit = parseInt(limit as string);
        const locId = locationId as string | undefined;

        const cacheKey = `products:${locId || 'global'}:${categoryId || 'all'}:${search || 'none'}:${cursor || 'start'}:${limit}`;
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) return res.json(JSON.parse(cachedData));

        // Scope inventory to a specific store when locationId provided
        const inventoryFilter: any = locId ? { where: { locationId: locId } } : true;

        const where: any = { isActive: true };
        if (categoryId) where.categoryId = categoryId;
        
        let products: any[] = [];
        let nextCursor: string | null = null;

        if (search) {
            const searchResults = await SearchService.getInstance().search(search as string, {
                limit: pageLimit,
                isActive: true
            });
            const productIds = searchResults.hits.map((h: any) => h.id);
            
            // Re-fetch full details from Prisma for the search results
            products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                include: {
                    category: { select: { name: true, slug: true } },
                    variants: { 
                        include: { 
                            pricing: { where: { isActive: true } },
                            inventory: inventoryFilter
                        } 
                    },
                    pricing: { where: { isActive: true } },
                    inventory: inventoryFilter
                }
            });
            // Maintain search relevance order
            products.sort((a, b) => productIds.indexOf(a.id) - productIds.indexOf(b.id));
        } else {
            products = await prisma.product.findMany({
                where,
                take: pageLimit + 1,
                cursor: cursor ? { id: cursor as string } : undefined,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: { select: { name: true, slug: true } },
                    variants: {
                        include: {
                            pricing: { where: { isActive: true } },
                            inventory: inventoryFilter
                        }
                    },
                    pricing: { where: { isActive: true } },
                    inventory: inventoryFilter
                }
            });

            if (products.length > pageLimit) {
                const nextItem = products.pop();
                nextCursor = nextItem!.id;
            }
        }

        const response = { data: products, nextCursor };
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching products" });
    }
};


export const getProductById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const product = await prisma.product.findUnique({
            where: { id: id as string },
            include: {
                category: true,
                variants: {
                    include: {
                        pricing: { where: { isActive: true } },
                        inventory: true
                    }
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });

        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Error fetching product" });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const { variants, categoryId, basePrice, ...productInfo } = req.body;
        const primaryLocation = await prisma.location.findFirst();

        const productData = { ...productInfo };
        if (productData.weightUnit) {
            productData.weightUnit = normalizeWeightUnit(productData.weightUnit);
        }

        // Resilient Category Resolution: Ensure a valid categoryId exists
        let finalCategoryId = categoryId;
        if (!finalCategoryId) {
            const uncategorized = await prisma.category.upsert({
                where: { slug: "uncategorized" },
                update: {},
                create: { 
                    name: "Uncategorized", 
                    slug: "uncategorized",
                    isActive: true 
                }
            });
            finalCategoryId = uncategorized.id;
        }

        const product = await prisma.product.create({
            data: {
                ...productData,
                basePrice: basePrice !== undefined && basePrice !== null
                    ? new Prisma.Decimal(basePrice)
                    : undefined,
                category: { connect: { id: finalCategoryId } },
                variants: variants ? {
                    create: variants.map((v: any) => ({
                        name: v.name || "Standard",
                        price: !isNaN(parseFloat(v.price)) ? parseFloat(v.price) : 0,
                        weight: (v.weight !== null && v.weight !== undefined && v.weight !== "" && !isNaN(parseFloat(v.weight))) ? parseFloat(v.weight) : null,
                        weightUnit: normalizeWeightUnit(v.weightUnit),
                        isActive: v.isActive !== undefined ? Boolean(v.isActive) : true
                    }))
                } : undefined
            },
            include: { variants: true, category: { select: { name: true } } }
        });

        // Background Indexing
        SearchService.getInstance().indexProduct(product).catch(e => console.error('ES Sync Error:', e));

        // Atomic inventory and pricing seeding for variants if requested
        if (variants && variants.length > 0) {
            const variantPromises = product.variants.map(async (v, idx) => {
                const originalVariant = variants[idx];
                const qty = parseInt(originalVariant.quantity) || 0;
                
                // 1. Create default pricing for this variant (both POS and WEB)
                for (const ch of ['POS', 'WEB'] as const) {
                    await prisma.pricing.create({
                        data: {
                            productId: product.id,
                            variantId: v.id,
                            channel: ch,
                            price: new Prisma.Decimal(originalVariant?.price ?? 0),
                            isActive: true
                        }
                    });
                }

                // 2. Handle inventory if primaryLocation is set
                if (primaryLocation && qty > 0) {
                    await prisma.inventory.create({
                        data: {
                            product: { connect: { id: product.id } },
                            variant: { connect: { id: v.id } },
                            location: { connect: { id: primaryLocation.id } },
                            currentStock: qty,
                            thresholdStock: parseInt(originalVariant.threshold) || 5
                        }
                    });

                    await prisma.batch.create({
                        data: {
                            batchNumber: `INIT-${Date.now()}-${idx}`,
                            product: { connect: { id: product.id } },
                            variant: { connect: { id: v.id } },
                            location: { connect: { id: primaryLocation.id } },
                            initialQty: qty,
                            remainingQty: qty,
                            costPrice: new Prisma.Decimal(originalVariant.price || 0).mul(0.7),
                            receivedDate: new Date()
                        }
                    });
                }
            });

            await Promise.all(variantPromises);
        }

        if ((!variants || variants.length === 0) && primaryLocation && req.body.quantity) {
            const qty = parseInt(req.body.quantity) || 0;
            if (qty > 0) {
                await prisma.inventory.create({
                    data: {
                        product: { connect: { id: product.id } },
                        location: { connect: { id: primaryLocation.id } },
                        currentStock: qty,
                        thresholdStock: parseInt(req.body.threshold) || 5
                    }
                });

                await prisma.batch.create({
                    data: {
                        batchNumber: `INIT-${Date.now()}`,
                        product: { connect: { id: product.id } },
                        location: { connect: { id: primaryLocation.id } },
                        initialQty: qty,
                        remainingQty: qty,
                        costPrice: new Prisma.Decimal(basePrice || 0).mul(0.7),
                        receivedDate: new Date()
                    }
                });
                
                // Create Base Pricing for both POS and WEB if no variants
                for (const ch of ['POS', 'WEB'] as const) {
                    await prisma.pricing.create({
                        data: {
                            productId: product.id,
                            channel: ch,
                            price: new Prisma.Decimal(basePrice || 0),
                            isActive: true
                        }
                    });
                }
            }
        }

        await invalidateProductCache();
        res.status(201).json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating product" });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { variants, id: _id, createdAt, updatedAt, category, inventory, pricing, ...productInfo } = req.body;
        
        if (productInfo.weightUnit) {
            productInfo.weightUnit = normalizeWeightUnit(productInfo.weightUnit);
        }

        const product = await prisma.$transaction(async (tx) => {
            const p = await tx.product.update({
                where: { id: id as string },
                data: {
                    ...productInfo,
                    variants: variants ? {
                        deleteMany: {},
                        create: variants.map((v: any) => ({
                            name: v.name,
                            price: parseFloat(v.price),
                            weight: parseFloat(v.weight),
                            weightUnit: normalizeWeightUnit(v.weightUnit),
                            isActive: true
                        }))
                    } : undefined
                },
                include: { variants: true }
            });

            // Sync Pricing across all channels for all variants
            if (p.variants && p.variants.length > 0) {
                for (const [idx, v] of p.variants.entries()) {
                    const originalVariant = variants ? variants[idx] : null;
                    const priceVal = originalVariant ? originalVariant.price : v.price;

                    // Update existing pricing records for this variant
                    await tx.pricing.updateMany({
                        where: { variantId: v.id },
                        data: { price: new Prisma.Decimal(priceVal || 0) }
                    });

                    // Ensure both POS and WEB channels exist
                    for (const ch of ['POS', 'WEB'] as const) {
                        const exists = await tx.pricing.findFirst({
                            where: { variantId: v.id, channel: ch }
                        });
                        if (!exists) {
                            await tx.pricing.create({
                                data: {
                                    productId: p.id,
                                    variantId: v.id,
                                    channel: ch,
                                    price: new Prisma.Decimal(priceVal),
                                    isActive: true
                                }
                            });
                        }
                    }
                }
            } else {
                // Base product pricing sync if no variants
                const priceVal = productInfo.basePrice !== undefined ? parseFloat(productInfo.basePrice) : Number(p.basePrice || 0);
                for (const ch of ['POS', 'WEB'] as const) {
                    const existing = await tx.pricing.findFirst({
                        where: { productId: p.id, variantId: null, channel: ch }
                    });
                    if (existing) {
                        await tx.pricing.update({
                            where: { id: existing.id },
                            data: { price: new Prisma.Decimal(priceVal), isActive: true }
                        });
                    } else {
                        await tx.pricing.create({
                            data: {
                                productId: p.id,
                                channel: ch,
                                price: new Prisma.Decimal(priceVal),
                                isActive: true
                            }
                        });
                    }
                }
            }
            return p;
        });

        const fullProduct = await prisma.product.findUnique({
            where: { id: id as string },
            include: { category: { select: { name: true } }, inventory: { select: { locationId: true } } }
        });
        SearchService.getInstance().indexProduct(fullProduct).catch(e => console.error('ES Sync Error:', e));

        await invalidateProductCache(id as string);
        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating product" });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.$transaction([
            prisma.orderItem.deleteMany({ where: { productId: id as string } }),
            prisma.inventoryLog.deleteMany({ where: { productId: id as string } }),
            prisma.batch.deleteMany({ where: { productId: id as string } }),
            prisma.inventory.deleteMany({ where: { productId: id as string } }),
            prisma.pricing.deleteMany({ where: { productId: id as string } }),
            prisma.cartItem.deleteMany({ where: { productId: id as string } }),
            prisma.productVariant.deleteMany({ where: { productId: id as string } }),
            prisma.product.delete({ where: { id: id as string } }),
        ]);

        SearchService.getInstance().deleteProduct(id as string).catch(e => console.error('ES Sync Error:', e));

        await invalidateProductCache();
        res.json({ message: "Product and dependencies purged successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting product" });
    }
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const getTrendingProducts = async (req: Request, res: Response) => {
    try {
        const { lat, lng, pincode, page = "1", limit = "10" } = req.query;
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 10;
        const skip = (pageNum - 1) * limitNum;

        const userLat = lat ? parseFloat(lat as string) : null;
        const userLng = lng ? parseFloat(lng as string) : null;

        // If coordinates are provided, perform proximity sorting
        if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng)) {
            // 1. Fetch active locations
            const locations = await prisma.location.findMany();
            
            // Calculate distance to each location
            const locationsWithDistance = locations.map(loc => {
                const locLat = loc.latitude !== null ? Number(loc.latitude) : null;
                const locLng = loc.longitude !== null ? Number(loc.longitude) : null;
                let distance = Infinity;
                if (locLat !== null && locLng !== null) {
                    distance = getDistance(userLat, userLng, locLat, locLng);
                }
                return { ...loc, distance };
            });

            // Sort locations by distance
            locationsWithDistance.sort((a, b) => a.distance - b.distance);

            // Create a map of locationId -> distance
            const distanceMap = new Map<string, number>();
            locationsWithDistance.forEach(loc => {
                distanceMap.set(loc.id, loc.distance);
            });

            // 2. Fetch active products with inventory and pricing details
            const products = await prisma.product.findMany({
                where: { isActive: true },
                include: {
                    category: { select: { name: true } },
                    variants: { 
                        include: { 
                            pricing: { where: { isActive: true } },
                            inventory: true
                        } 
                    },
                    pricing: { where: { isActive: true } },
                    inventory: true
                }
            });

            // 3. For each product, find the minimum distance to a location where it is in stock.
            const productsWithDistance = products.map(product => {
                let minDistance = Infinity;

                // Check base product inventory
                if (product.inventory && product.inventory.length > 0) {
                    product.inventory.forEach(inv => {
                        if (Number(inv.currentStock) > 0) {
                            const dist = distanceMap.get(inv.locationId);
                            if (dist !== undefined && dist < minDistance) {
                                minDistance = dist;
                            }
                        }
                    });
                }

                // Check variant inventories
                if (product.variants && product.variants.length > 0) {
                    product.variants.forEach(variant => {
                        if (variant.inventory && variant.inventory.length > 0) {
                            variant.inventory.forEach(inv => {
                                if (Number(inv.currentStock) > 0) {
                                    const dist = distanceMap.get(inv.locationId);
                                    if (dist !== undefined && dist < minDistance) {
                                        minDistance = dist;
                                    }
                                }
                            });
                        }
                    });
                }

                return { ...product, minDistance };
            });

            // 4. Sort products:
            // - In stock at closer locations first.
            // - Products with minDistance = Infinity (out of stock everywhere) go to the end.
            // - Secondary sorting by createdAt desc.
            productsWithDistance.sort((a, b) => {
                if (a.minDistance !== b.minDistance) {
                    return a.minDistance - b.minDistance;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            // 5. Apply pagination
            const paginated = productsWithDistance.slice(skip, skip + limitNum);
            // Remove the minDistance temporary field before responding
            const cleaned = paginated.map(({ minDistance, ...rest }) => rest);
            return res.json(cleaned);
        }

        // Default logic: Fetch with standard caching
        const cacheKey = `products:trending:${pageNum}:${limitNum}`;
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) return res.json(JSON.parse(cachedData));

        const products = await prisma.product.findMany({
            where: { isActive: true },
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            include: {
                category: { select: { name: true } },
                variants: { 
                    include: { 
                        pricing: { where: { isActive: true } },
                        inventory: true
                    } 
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });

        await redisClient.setEx(cacheKey, TRENDING_TTL, JSON.stringify(products));
        res.json(products);
    } catch (error) {
        console.error("Error fetching trending products:", error);
        res.status(500).json({ message: "Error fetching trending merchandise" });
    }
};

// ─── Restored Missing Functions ───────────────────────────────────────────

export const getFlashDeals = async (req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            take: 10,
            include: {
                variants: { 
                    include: { 
                        pricing: { where: { isActive: true } },
                        inventory: true
                    } 
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching flash deals" });
    }
};

export const getSimilarProducts = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const product = await prisma.product.findUnique({ where: { id: id as string } });
        if (!product) return res.status(404).json({ message: "Product not found" });

        const products = await prisma.product.findMany({
            where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true },
            take: 6,
            include: {
                variants: { 
                    include: { 
                        pricing: { where: { isActive: true } },
                        inventory: true
                    } 
                },
                pricing: { where: { isActive: true } },
                inventory: true
            }
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching similar products" });
    }
};

export const checkServiceability = async (req: Request, res: Response) => {
    const { pincode } = req.params;
    res.json({ serviceable: true, message: "Serviceable at " + pincode });
};

export const getBuyAgain = async (req: any, res: Response) => {
    const userId = req.user?.userId;
    try {
        const orders = await prisma.order.findMany({
            where: { userId },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: { include: { variants: true, pricing: true } } } } }
        });
        const products = Array.from(new Set(orders.flatMap(o => o.items.map(i => i.product))));
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching buy again products" });
    }
};

export const toggleProductStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const product = await prisma.product.findUnique({ where: { id: id as string } });
        if (!product) return res.status(404).json({ message: "Product not found" });

        const updated = await prisma.product.update({
            where: { id: id as string },
            data: { isActive: !product.isActive },
            include: { category: { select: { name: true } }, inventory: { select: { locationId: true } } }
        });
        SearchService.getInstance().indexProduct(updated).catch(e => console.error('ES Sync Error:', e));
        await invalidateProductCache();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Error toggling product status" });
    }
};

export const trackTrendingOnOrder = async (items: { productId: string, quantity: any }[], locationId: string) => {
    try {
        for (const item of items) {
            const key = `trending:${locationId}:${item.productId}`;
            await redisClient.incrBy(key, Number(item.quantity) || 1);
            await redisClient.expire(key, TRENDING_TTL);
        }
    } catch (error) {
        console.error("Trending Error:", error);
    }
};

export const getProductsAdmin = async (req: Request, res: Response) => {
    try {
        const { categoryId, search } = req.query;
        const where: any = {};
        
        if (categoryId) where.categoryId = categoryId;
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { sku: { contains: search as string, mode: 'insensitive' } },
                { barcode: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        // Admin view returns ALL products (active/inactive) without aggressive pagination caps
        // to facilitate comprehensive catalog management.
        const products = await prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                category: { select: { name: true, slug: true } },
                variants: {
                    include: {
                        pricing: true,
                        inventory: true
                    }
                },
                pricing: true,
                inventory: true
            }
        });

        res.json(products);
    } catch (error: any) {
        console.error("Admin catalog fetch failure:", error);
        res.status(500).json({ error: error.message });
    }
};

export const bulkImportProducts = async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    const categoryCache = new Map<string, string>();
    let successCount = 0;
    let failureCount = 0;

    let batchProducts = new Map<string, any>();
    const BATCH_SIZE = 50;

    const sanitizeString = (val: any): string => {
        if (val === undefined || val === null) return "";
        const clean = String(val).trim();
        // Prevent CSV Formula Injection
        if (clean.startsWith("=") || clean.startsWith("+") || clean.startsWith("-") || clean.startsWith("@")) {
            return `'${clean}`;
        }
        return clean;
    };

    const processBatch = async () => {
        if (batchProducts.size === 0) return;

        const productNames = Array.from(batchProducts.keys());
        // Preload existing products
        const existingProducts = await prisma.product.findMany({
            where: {
                name: { in: productNames, mode: 'insensitive' }
            },
            include: {
                variants: true
            }
        });
        const existingProductMap = new Map<string, any>();
        existingProducts.forEach(p => existingProductMap.set(p.name.toLowerCase(), p));

        await prisma.$transaction(async (tx) => {
            for (const [productName, productData] of batchProducts) {
                try {
                    // Resolve Category
                    const categoryName = productData.categoryName;
                    let categoryId = categoryCache.get(categoryName.toLowerCase());
                    if (!categoryId) {
                        let cat = await tx.category.findFirst({
                            where: { name: { equals: categoryName, mode: 'insensitive' } }
                        });
                        if (!cat) {
                            cat = await tx.category.create({
                                data: {
                                    name: categoryName,
                                    slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(-4),
                                    isActive: true
                                }
                            });
                        }
                        categoryId = cat.id;
                        categoryCache.set(categoryName.toLowerCase(), categoryId);
                    }

                    const existing = existingProductMap.get(productName.toLowerCase());
                    const primaryLocation = await tx.location.findFirst();

                    if (existing) {
                        // Update product
                        const updatedProduct = await tx.product.update({
                            where: { id: existing.id },
                            data: {
                                sku: productData.sku,
                                description: productData.description,
                                categoryId: categoryId,
                                images: productData.images,
                                variants: {
                                    deleteMany: {},
                                    create: productData.variants.map((v: any) => ({
                                        name: v.name,
                                        price: new Prisma.Decimal(v.price),
                                        weight: v.weight !== null ? new Prisma.Decimal(v.weight) : null,
                                        weightUnit: normalizeWeightUnit(v.weightUnit),
                                        isActive: true
                                    }))
                                }
                            },
                            include: { variants: true }
                        });

                        // Sync Pricing for all variants across both POS and WEB channels
                        if (updatedProduct.variants && updatedProduct.variants.length > 0) {
                            for (const [idx, v] of updatedProduct.variants.entries()) {
                                const originalVariant = productData.variants[idx];
                                const priceVal = originalVariant ? originalVariant.price : v.price;

                                for (const ch of ['POS', 'WEB'] as const) {
                                    const existingPricing = await tx.pricing.findFirst({
                                        where: { variantId: v.id, channel: ch }
                                    });
                                    if (existingPricing) {
                                        await tx.pricing.update({
                                            where: { id: existingPricing.id },
                                            data: { price: new Prisma.Decimal(priceVal) }
                                        });
                                    } else {
                                        await tx.pricing.create({
                                            data: {
                                                productId: updatedProduct.id,
                                                variantId: v.id,
                                                channel: ch,
                                                price: new Prisma.Decimal(priceVal),
                                                isActive: true
                                            }
                                        });
                                    }
                                }
                            }
                        }
                        SearchService.getInstance().indexProduct(updatedProduct).catch(e => console.error('ES Sync Error:', e));
                    } else {
                        // Create product
                        const newProduct = await tx.product.create({
                            data: {
                                name: productData.name,
                                slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(-4),
                                sku: productData.sku,
                                description: productData.description,
                                categoryId: categoryId,
                                images: productData.images,
                                variants: {
                                    create: productData.variants.map((v: any) => ({
                                        name: v.name,
                                        price: new Prisma.Decimal(v.price),
                                        weight: v.weight !== null ? new Prisma.Decimal(v.weight) : null,
                                        weightUnit: normalizeWeightUnit(v.weightUnit),
                                        isActive: true
                                    }))
                                }
                            },
                            include: { variants: true }
                        });

                        // Handle Pricing and Inventory for new variants (both POS and WEB)
                        if (newProduct.variants && newProduct.variants.length > 0) {
                            for (const [idx, v] of newProduct.variants.entries()) {
                                const originalVariant = productData.variants[idx];
                                const qty = originalVariant.quantity || 0;

                                for (const ch of ['POS', 'WEB'] as const) {
                                    await tx.pricing.create({
                                        data: {
                                            productId: newProduct.id,
                                            variantId: v.id,
                                            channel: ch,
                                            price: new Prisma.Decimal(originalVariant.price),
                                            isActive: true
                                        }
                                    });
                                }

                                if (primaryLocation && qty > 0) {
                                    await tx.inventory.create({
                                        data: {
                                            productId: newProduct.id,
                                            variantId: v.id,
                                            locationId: primaryLocation.id,
                                            currentStock: qty,
                                            thresholdStock: originalVariant.threshold || 5
                                        }
                                    });

                                    await tx.batch.create({
                                        data: {
                                            batchNumber: `INIT-${Date.now()}-${idx}`,
                                            productId: newProduct.id,
                                            variantId: v.id,
                                            locationId: primaryLocation.id,
                                            initialQty: qty,
                                            remainingQty: qty,
                                            costPrice: new Prisma.Decimal(originalVariant.price).mul(0.7),
                                            receivedDate: new Date()
                                        }
                                    });
                                }
                            }
                        }
                        SearchService.getInstance().indexProduct(newProduct).catch(e => console.error('ES Sync Error:', e));
                    }
                    successCount++;
                } catch (error) {
                    console.error(`Failed to process product [${productName}] during bulk import:`, error);
                    failureCount++;
                }
            }
        });

        batchProducts.clear();
    };

    try {
        const parser = fs.createReadStream(filePath).pipe(csv());
        for await (const row of parser) {
            // Trim all headers
            const cleanedRow: any = {};
            for (const key of Object.keys(row)) {
                cleanedRow[key.trim()] = row[key];
            }

            const rawName = cleanedRow["Product Name"] || cleanedRow["Product Na"] || cleanedRow["product name"] || cleanedRow["ProductName"] || cleanedRow["name"];
            const productName = sanitizeString(rawName);
            if (!productName) continue;

            const categoryName = sanitizeString(cleanedRow["Category"] || cleanedRow["category"] || cleanedRow["CATEGORY"] || cleanedRow["Category Name"] || cleanedRow["category name"] || cleanedRow["CATEGORY NAME"]) || "Uncategorized";
            const sku = sanitizeString(cleanedRow["SKU"] || cleanedRow["sku"]) || null;
            const description = sanitizeString(cleanedRow["Description"] || cleanedRow["description"]) || "";
            const imageUrl = sanitizeString(cleanedRow["Image URL"] || cleanedRow["image url"] || cleanedRow["imageUrl"] || cleanedRow["ImageURL"]) || null;
            const images = imageUrl ? [imageUrl] : [];

            // Variant info
            const variantName = sanitizeString(cleanedRow["Variant Name"] || cleanedRow["Variant Na"] || cleanedRow["variant name"]) || "Standard";
            const rawWeight = cleanedRow["Weight"] || cleanedRow["weight"];
            const weight = !isNaN(parseFloat(rawWeight)) ? parseFloat(rawWeight) : null;
            const weightUnit = sanitizeString(cleanedRow["Unit"] || cleanedRow["unit"] || cleanedRow["UNIT"] || cleanedRow["Weight Unit"] || cleanedRow["weight unit"] || cleanedRow["WEIGHT UNIT"]) || "KG";
            
            const rawRate = cleanedRow["Rate"] || cleanedRow["rate"] || cleanedRow["Price"] || cleanedRow["price"];
            const price = !isNaN(parseFloat(rawRate)) ? parseFloat(rawRate) : 0;
            
            const rawQty = cleanedRow["Initial Qty"] || cleanedRow["initial qty"] || cleanedRow["Qty"] || cleanedRow["qty"];
            const quantity = !isNaN(parseInt(rawQty)) ? parseInt(rawQty) : 0;
            
            const rawThreshold = cleanedRow["Low Stock Alert"] || cleanedRow["low stock alert"] || cleanedRow["Threshold"] || cleanedRow["threshold"];
            const threshold = !isNaN(parseInt(rawThreshold)) ? parseInt(rawThreshold) : 5;

            const variantData = {
                name: variantName,
                weight,
                weightUnit,
                price,
                quantity,
                threshold
            };

            const key = productName.toLowerCase();
            if (batchProducts.has(key)) {
                const prod = batchProducts.get(key);
                prod.variants.push(variantData);
            } else {
                batchProducts.set(key, {
                    name: productName,
                    categoryName,
                    sku,
                    description,
                    images,
                    variants: [variantData]
                });
            }

            if (batchProducts.size >= BATCH_SIZE) {
                await processBatch();
            }
        }

        // Process any remaining items
        await processBatch();

        // Clean up uploaded file
        fs.unlink(filePath, (err) => {
            if (err) console.error("Failed to delete temp import file:", err);
        });

        // Invalidate Product Cache
        await invalidateProductCache();

        res.status(200).json({
            message: `Merchandise Ingestion Complete: ${successCount} successful product syncs, ${failureCount} failures.`,
            successCount,
            failureCount
        });

    } catch (error: any) {
        console.error("Bulk Import Process Failed:", error);
        // Clean up file on error
        fs.unlink(filePath, (err) => {
            if (err) console.error("Failed to delete temp import file:", err);
        });
        res.status(500).json({ message: `Bulk import failed: ${error.message}` });
    }
};

export const uploadProductImage = async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: "No file provided" });
        }

        const path = require("path");
        const crypto = require("crypto");

        const ext = path.extname(file.originalname).toLowerCase();
        
        // Generate random secure filename to prevent path traversal / collisions
        const randomName = `${crypto.randomUUID()}${ext}`;
        
        const productsUploadDir = path.join(process.cwd(), "public/uploads/products");
        if (!fs.existsSync(productsUploadDir)) {
            fs.mkdirSync(productsUploadDir, { recursive: true });
        }
        
        const targetPath = path.join(productsUploadDir, randomName);
        
        // Save file buffer
        await fs.promises.writeFile(targetPath, file.buffer);
        
        // Return public relative path
        const publicUrl = `/uploads/products/${randomName}`;
        res.status(200).json({ url: publicUrl, filename: randomName });
    } catch (error) {
        console.error("Error saving uploaded image:", error);
        res.status(500).json({ message: "Failed to upload image" });
    }
};

export const syncAllProductPricing = async () => {
    try {
        const products = await prisma.product.findMany({
            include: { variants: true }
        });

        for (const p of products) {
            if (p.variants && p.variants.length > 0) {
                for (const v of p.variants) {
                    const priceVal = v.price;
                    for (const ch of ['POS', 'WEB'] as const) {
                        const existing = await prisma.pricing.findFirst({
                            where: { variantId: v.id, channel: ch }
                        });
                        if (existing) {
                            await prisma.pricing.update({
                                where: { id: existing.id },
                                data: { price: priceVal, isActive: true }
                            });
                        } else {
                            await prisma.pricing.create({
                                data: {
                                    productId: p.id,
                                    variantId: v.id,
                                    channel: ch,
                                    price: priceVal,
                                    isActive: true
                                }
                            });
                        }
                    }
                }
            } else if (p.basePrice) {
                const priceVal = p.basePrice;
                for (const ch of ['POS', 'WEB'] as const) {
                    const existing = await prisma.pricing.findFirst({
                        where: { productId: p.id, variantId: null, channel: ch }
                    });
                    if (existing) {
                        await prisma.pricing.update({
                            where: { id: existing.id },
                            data: { price: priceVal, isActive: true }
                        });
                    } else {
                        await prisma.pricing.create({
                            data: {
                                productId: p.id,
                                channel: ch,
                                price: priceVal,
                                isActive: true
                            }
                        });
                    }
                }
            }
        }
        await invalidateProductCache();
        console.log("[PricingSync] Product pricing sync complete across all channels");
    } catch (err) {
        console.error("[PricingSync] Failed to sync product pricing across channels:", err);
    }
};

export const syncProductPricingHandler = async (req: Request, res: Response) => {
    try {
        await syncAllProductPricing();
        res.json({ message: "Product pricing synchronized across all channels successfully." });
    } catch (err: any) {
        res.status(500).json({ message: "Failed to synchronize product pricing.", error: err.message });
    }
};
