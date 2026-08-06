import { Request, Response } from "express";
import prisma from "../config/prisma";
import logger from "../utils/logger";
import { WeightUnit } from "@prisma/client";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string };
}

// ─── GET /api/v1/variants ───────────────────────────────────────────────────
export const getVariants = async (req: Request, res: Response) => {
    try {
        const { search, productId, isActive } = req.query;

        const whereClause: any = {};

        if (productId) {
            whereClause.productId = String(productId);
        }

        if (isActive !== undefined && isActive !== "") {
            whereClause.isActive = isActive === "true";
        }

        if (search) {
            const query = String(search).trim();
            whereClause.OR = [
                { name: { contains: query, mode: "insensitive" } },
                { product: { name: { contains: query, mode: "insensitive" } } },
            ];
        }

        const variants = await prisma.productVariant.findMany({
            where: whereClause,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        images: true,
                        sku: true,
                        basePrice: true,
                        category: {
                            select: { id: true, name: true }
                        }
                    }
                },
                inventory: {
                    select: {
                        locationId: true,
                        currentStock: true,
                        location: { select: { id: true, name: true } }
                    }
                },
                pricing: {
                    select: {
                        id: true,
                        channel: true,
                        price: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Compute total stock count for each variant across locations
        const formattedVariants = variants.map((variant: any) => {
            const totalStock = (variant.inventory || []).reduce((sum: number, inv: any) => sum + Number(inv.currentStock || 0), 0);
            return {
                ...variant,
                price: Number(variant.price),
                weight: variant.weight ? Number(variant.weight) : null,
                totalStock,
            };
        });

        return res.json({
            success: true,
            count: formattedVariants.length,
            data: formattedVariants
        });
    } catch (error: any) {
        logger.error(`[VariantController] getVariants error: ${error.message}`);
        return res.status(500).json({ message: "Failed to fetch product variants" });
    }
};

// ─── GET /api/v1/variants/:id ───────────────────────────────────────────────
export const getVariantById = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const variant = await prisma.productVariant.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        images: true,
                        sku: true,
                        basePrice: true,
                        category: { select: { id: true, name: true } }
                    }
                },
                inventory: {
                    include: { location: { select: { id: true, name: true } } }
                },
                pricing: true
            }
        });

        if (!variant) {
            return res.status(404).json({ message: "Product variant not found" });
        }

        return res.json({
            success: true,
            data: {
                ...variant,
                price: Number(variant.price),
                weight: variant.weight ? Number(variant.weight) : null
            }
        });
    } catch (error: any) {
        logger.error(`[VariantController] getVariantById error: ${error.message}`);
        return res.status(500).json({ message: "Failed to fetch variant details" });
    }
};

// ─── POST /api/v1/variants ──────────────────────────────────────────────────
export const createVariant = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { productId, name, price, weight, weightUnit, isActive } = req.body;

        if (!productId || !name || price === undefined) {
            return res.status(400).json({ message: "productId, name, and price are required" });
        }

        const numericPrice = Number(price);
        if (isNaN(numericPrice) || numericPrice < 0) {
            return res.status(400).json({ message: "Invalid price value" });
        }

        // Verify product exists
        const productExists = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true }
        });

        if (!productExists) {
            return res.status(404).json({ message: "Target product not found" });
        }

        const validWeightUnit = Object.values(WeightUnit).includes(weightUnit) ? weightUnit : WeightUnit.GM;

        const newVariant = await prisma.$transaction(async (tx: any) => {
            const variant = await tx.productVariant.create({
                data: {
                    productId,
                    name: String(name).trim(),
                    price: numericPrice,
                    weight: weight !== undefined && weight !== null && weight !== "" ? Number(weight) : null,
                    weightUnit: validWeightUnit,
                    isActive: isActive !== undefined ? Boolean(isActive) : true,
                },
                include: {
                    product: {
                        select: { id: true, name: true, images: true, category: { select: { name: true } } }
                    }
                }
            });

            // Seed pricing records for this variant (both POS and WEB)
            for (const ch of ['POS', 'WEB'] as const) {
                await tx.pricing.create({
                    data: {
                        productId,
                        variantId: variant.id,
                        channel: ch,
                        price: numericPrice
                    }
                });
            }

            return variant;
        });

        logger.info(`[VariantController] Variant created: ${newVariant.id} (${newVariant.name}) for product ${productId}`);

        return res.status(201).json({
            success: true,
            message: "Variant created successfully",
            data: {
                ...newVariant,
                price: Number(newVariant.price),
                weight: newVariant.weight ? Number(newVariant.weight) : null
            }
        });
    } catch (error: any) {
        logger.error(`[VariantController] createVariant error: ${error.message}`);
        return res.status(500).json({ message: error.message || "Failed to create variant" });
    }
};

// ─── PUT /api/v1/variants/:id ───────────────────────────────────────────────
export const updateVariant = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = String(req.params.id);
        const { name, price, weight, weightUnit, isActive, productId } = req.body;

        const existing = await prisma.productVariant.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({ message: "Product variant not found" });
        }

        const updateData: any = {};

        if (name !== undefined) updateData.name = String(name).trim();
        if (price !== undefined) {
            const numPrice = Number(price);
            if (isNaN(numPrice) || numPrice < 0) {
                return res.status(400).json({ message: "Invalid price value" });
            }
            updateData.price = numPrice;
        }
        if (weight !== undefined) {
            updateData.weight = weight !== null && weight !== "" ? Number(weight) : null;
        }
        if (weightUnit !== undefined && Object.values(WeightUnit).includes(weightUnit)) {
            updateData.weightUnit = weightUnit;
        }
        if (isActive !== undefined) {
            updateData.isActive = Boolean(isActive);
        }
        if (productId !== undefined && productId !== existing.productId) {
            updateData.productId = productId;
        }

        const updatedVariant = await prisma.$transaction(async (tx: any) => {
            const variant = await tx.productVariant.update({
                where: { id },
                data: updateData,
                include: {
                    product: {
                        select: { id: true, name: true, images: true, category: { select: { name: true } } }
                    }
                }
            });

            // Update pricing records for both POS and WEB channels
            if (updateData.price !== undefined) {
                for (const ch of ['POS', 'WEB'] as const) {
                    const existingPricing = await tx.pricing.findFirst({
                        where: {
                            productId: variant.productId,
                            variantId: variant.id,
                            channel: ch
                        }
                    });
                    if (existingPricing) {
                        await tx.pricing.update({
                            where: { id: existingPricing.id },
                            data: { price: updateData.price }
                        });
                    } else {
                        await tx.pricing.create({
                            data: {
                                productId: variant.productId,
                                variantId: variant.id,
                                channel: ch,
                                price: updateData.price
                            }
                        });
                    }
                }
            }

            return variant;
        });

        logger.info(`[VariantController] Variant updated: ${updatedVariant.id}`);

        return res.json({
            success: true,
            message: "Variant updated successfully",
            data: {
                ...updatedVariant,
                price: Number(updatedVariant.price),
                weight: updatedVariant.weight ? Number(updatedVariant.weight) : null
            }
        });
    } catch (error: any) {
        logger.error(`[VariantController] updateVariant error: ${error.message}`);
        return res.status(500).json({ message: error.message || "Failed to update variant" });
    }
};

// ─── PATCH /api/v1/variants/:id/toggle ─────────────────────────────────────
export const toggleVariantStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = String(req.params.id);

        const existing = await prisma.productVariant.findUnique({
            where: { id },
            select: { id: true, isActive: true, name: true }
        });

        if (!existing) {
            return res.status(404).json({ message: "Product variant not found" });
        }

        const updated = await prisma.productVariant.update({
            where: { id },
            data: { isActive: !existing.isActive }
        });

        return res.json({
            success: true,
            message: `Variant ${updated.name} ${updated.isActive ? "activated" : "deactivated"}`,
            data: updated
        });
    } catch (error: any) {
        logger.error(`[VariantController] toggleVariantStatus error: ${error.message}`);
        return res.status(500).json({ message: "Failed to toggle variant status" });
    }
};

// ─── DELETE /api/v1/variants/:id ───────────────────────────────────────────
export const deleteVariant = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = String(req.params.id);

        const existing = await prisma.productVariant.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { orderItems: true, cartItems: true }
                }
            }
        });

        if (!existing) {
            return res.status(404).json({ message: "Product variant not found" });
        }

        // Clean up related inventory, pricing, batches before deleting variant
        await prisma.$transaction(async (tx: any) => {
            await tx.inventory.deleteMany({ where: { variantId: id } });
            await tx.inventoryLog.deleteMany({ where: { variantId: id } });
            await tx.pricing.deleteMany({ where: { variantId: id } });
            await tx.batch.deleteMany({ where: { variantId: id } });
            await tx.cartItem.deleteMany({ where: { variantId: id } });
            await tx.productVariant.delete({ where: { id } });
        });

        logger.info(`[VariantController] Variant deleted: ${id}`);

        return res.json({
            success: true,
            message: "Product variant deleted successfully"
        });
    } catch (error: any) {
        logger.error(`[VariantController] deleteVariant error: ${error.message}`);
        return res.status(500).json({ message: "Failed to delete product variant" });
    }
};
