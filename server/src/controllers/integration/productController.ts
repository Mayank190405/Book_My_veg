import { Response } from "express";
import prisma from "../../config/prisma";
import { logAuthorizationFailure, logDataHarvest } from "../../middleware/integrationThreatDetector";

export const getProducts = async (req: any, res: Response) => {
    const integration = req.integration;
    const { limit = 20, cursor, search } = req.query;

    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const where: any = { isActive: true };

    if (search) {
        where.OR = [
            { name: { contains: search as string, mode: "insensitive" } },
            { sku: { contains: search as string, mode: "insensitive" } },
            { barcode: { contains: search as string, mode: "insensitive" } }
        ];
    }

    try {
        const products = await prisma.product.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor as string } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                variants: {
                    where: { isActive: true },
                    include: {
                        inventory: integration.role === "STORE_ADMIN"
                            ? { where: { locationId: integration.locationId } }
                            : true,
                        pricing: { where: { isActive: true } }
                    }
                },
                inventory: integration.role === "STORE_ADMIN"
                    ? { where: { locationId: integration.locationId } }
                    : true,
                pricing: { where: { isActive: true } },
                category: { select: { id: true, name: true, slug: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const hasMore = products.length > parsedLimit;
        const data = hasMore ? products.slice(0, parsedLimit) : products;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        // Log record consumption volume
        await logDataHarvest(req, data.length);

        res.json({ data, nextCursor });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createProduct = async (req: any, res: Response) => {
    const integration = req.integration;

    // Enforce Admin Key Only for catalog modifications
    if (integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required to create products." });
    }

    const { name, slug, description, categoryId, basePrice, sku, barcode, taxSlab, gstRate, hsnCode } = req.body;

    if (!name || !slug || !categoryId) {
        return res.status(400).json({ message: "Name, slug, and categoryId are required." });
    }

    try {
        const product = await prisma.product.create({
            data: {
                name,
                slug,
                description,
                categoryId,
                basePrice: basePrice ? parseFloat(basePrice) : null,
                sku,
                barcode,
                taxSlab: taxSlab ? parseFloat(taxSlab) : 0,
                gstRate: gstRate ? parseFloat(gstRate) : 0,
                hsnCode,
                isActive: true
            }
        });

        res.status(201).json(product);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Slug, SKU, or Barcode already exists." });
        }
        res.status(500).json({ error: error.message });
    }
};

export const updateProduct = async (req: any, res: Response) => {
    const integration = req.integration;

    // Enforce Admin Key Only for catalog modifications
    if (integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required to update products." });
    }

    const { id } = req.params;
    const { name, description, categoryId, basePrice, sku, barcode, taxSlab, gstRate, hsnCode, isActive } = req.body;

    try {
        const product = await prisma.product.update({
            where: { id },
            data: {
                name,
                description,
                categoryId,
                basePrice: basePrice !== undefined ? (basePrice ? parseFloat(basePrice) : null) : undefined,
                sku,
                barcode,
                taxSlab: taxSlab !== undefined ? parseFloat(taxSlab) : undefined,
                gstRate: gstRate !== undefined ? parseFloat(gstRate) : undefined,
                hsnCode,
                isActive
            }
        });

        res.json(product);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateInventory = async (req: any, res: Response) => {
    const integration = req.integration;
    const { productId, variantId, locationId, currentStock, thresholdStock } = req.body;

    if (!productId || currentStock === undefined) {
        return res.status(400).json({ message: "productId and currentStock are required." });
    }

    // Align location for store-level API keys
    let targetLocationId = locationId;
    if (integration.role === "STORE_ADMIN") {
        if (locationId && locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Store admins can only manage local store inventory." });
        }
        targetLocationId = integration.locationId;
    }

    if (!targetLocationId) {
        return res.status(400).json({ message: "LocationId is required." });
    }

    try {
        // Atomic inventory adjustment via upsert
        const stock = parseFloat(currentStock);
        const threshold = thresholdStock !== undefined ? parseFloat(thresholdStock) : 5;

        const inventory = await prisma.inventory.upsert({
            where: {
                productId_locationId_variantId: {
                    productId,
                    locationId: targetLocationId,
                    variantId: variantId || null
                }
            },
            update: {
                currentStock: stock,
                thresholdStock: threshold,
                lastRestocked: new Date(),
                isLowStock: stock <= threshold
            },
            create: {
                productId,
                locationId: targetLocationId,
                variantId: variantId || null,
                currentStock: stock,
                thresholdStock: threshold,
                lastRestocked: new Date(),
                isLowStock: stock <= threshold
            }
        });

        // Create log record
        await prisma.inventoryLog.create({
            data: {
                productId,
                variantId: variantId || null,
                locationId: targetLocationId,
                type: "ADJUSTMENT",
                beforeQty: 0, // Placeholder
                afterQty: stock,
                delta: stock,
                staffId: `API_KEY_${integration.id}`
            }
        });

        res.json(inventory);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updatePricing = async (req: any, res: Response) => {
    const integration = req.integration;

    // Enforce Admin Key Only for pricing modifications
    if (integration.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden. Admin API Key required to update pricing." });
    }

    const { productId, variantId, channel, price, discountType, discountValue, startDate, endDate } = req.body;

    if (!productId || price === undefined) {
        return res.status(400).json({ message: "productId and price are required." });
    }

    try {
        // Create or update pricing record
        const pricing = await prisma.pricing.create({
            data: {
                productId,
                variantId: variantId || null,
                channel: channel || "WEB",
                price: parseFloat(price),
                discountType,
                discountValue: discountValue ? parseFloat(discountValue) : null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                isActive: true
            }
        });

        res.status(201).json(pricing);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
