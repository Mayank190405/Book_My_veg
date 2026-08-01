import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

export const getStoreInventory = async (req: Request, res: Response) => {
    const { locationId } = req.params;
    const authUser = (req as any).user;

    // Enforce high-fidelity regional isolation with defensive role validation
    if (authUser?.role === "STORE_ADMIN" && authUser.locationId !== locationId) {
        return res.status(403).json({ message: "Access Denied: Regional Data Isolation Protocol Active" });
    }

    try {
        const inventory = await prisma.inventory.findMany({
            where: { locationId: locationId as string },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        barcode: true,
                        images: true,
                        weightUnit: true,
                        category: { select: { name: true } }
                    }
                },
                variant: {
                    select: {
                        id: true,
                        name: true,
                        weight: true,
                        weightUnit: true,
                        price: true
                    }
                }
            },
            orderBy: [
                { product: { name: "asc" } },
                { updatedAt: "desc" }
            ]
        });
        res.json(inventory);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const adjustStock = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { currentStock, thresholdStock } = req.body;
    const authUser = (req as any).user;

    try {
        const current = await prisma.inventory.findUnique({ where: { id: id as string } });
        if (!current) return res.status(404).json({ message: "Inventory record not found" });

        // Institutional Authorization Check with defensive role validation
        if (authUser?.role === "STORE_ADMIN" && authUser.locationId !== current.locationId) {
            return res.status(403).json({ message: "Access Denied: Cross-Hub manipulation restricted" });
        }

        const nextStock = currentStock !== undefined ? new Prisma.Decimal(currentStock) : (current.currentStock as any);
        const nextThreshold = thresholdStock !== undefined ? new Prisma.Decimal(thresholdStock) : (current.thresholdStock as any);

        const inventory = await prisma.inventory.update({
            where: { id: id as string },
            data: {
                currentStock: nextStock,
                thresholdStock: nextThreshold,
                isLowStock: Number(nextStock) <= Number(nextThreshold)
            }
        });

        res.json(inventory);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const syncInventory = async (req: Request, res: Response) => {
    const { locationId } = req.body;
    const authUser = (req as any).user;

    if (!locationId) return res.status(400).json({ message: "locationId is required" });

    // Enforce isolation for sync protocol with defensive role validation
    if (authUser?.role === "STORE_ADMIN" && authUser.locationId !== locationId) {
        return res.status(403).json({ message: "Access Denied: Unauthorized Hub Synchronization Request" });
    }

    try {
        const targetLocationId = locationId as string;
        const products = await prisma.product.findMany({
            include: { variants: true }
        });

        let count = 0;
        for (const product of products) {
            if (product.variants.length > 0) {
                // Delete redundant 0-stock null-variant inventory records when variants exist
                await prisma.inventory.deleteMany({
                    where: {
                        productId: product.id,
                        locationId: targetLocationId,
                        variantId: null,
                        currentStock: 0
                    }
                });

                for (const variant of product.variants) {
                    const existing = await prisma.inventory.findFirst({
                        where: {
                            productId: product.id,
                            locationId: targetLocationId,
                            variantId: variant.id
                        }
                    });
                    if (!existing) {
                        await prisma.inventory.create({
                            data: {
                                productId: product.id,
                                locationId: targetLocationId,
                                variantId: variant.id,
                                currentStock: 0,
                                thresholdStock: 5
                            }
                        });
                    }
                    count++;
                }
            } else {
                const existing = await prisma.inventory.findFirst({
                    where: {
                        productId: product.id,
                        locationId: targetLocationId,
                        variantId: null
                    }
                });
                if (!existing) {
                    await prisma.inventory.create({
                        data: {
                            productId: product.id,
                            locationId: targetLocationId,
                            variantId: null,
                            currentStock: 0,
                            thresholdStock: 5
                        }
                    });
                }
                count++;
            }
        }
        res.json({ message: `Inventory synced for ${count} nodes`, count });
    } catch (error: any) {
        console.error("Sync Logic Failure:", error);
        res.status(500).json({ error: error.message });
    }
};
export const createAdjustment = async (req: Request, res: Response) => {
    const { productId, variantId, locationId, quantity, type, reason } = req.body;
    try {
        const current = await prisma.inventory.findFirst({
            where: {
                productId,
                locationId,
                variantId: variantId || null
            }
        });

        if (!current) return res.status(404).json({ message: "Inventory node not found for this product/location combination" });

        const adjustment = new Prisma.Decimal(quantity || "0");
        const nextStock = (type === "PURCHASE" || (type === "ADJUSTMENT" && adjustment.gt(0)))
            ? (new Prisma.Decimal(current.currentStock as any)).plus(adjustment)
            : (new Prisma.Decimal(current.currentStock as any)).minus(adjustment.abs());

        const updated = await prisma.inventory.update({
            where: { id: current.id },
            data: {
                currentStock: nextStock.gt(0) ? nextStock : 0,
                isLowStock: (nextStock.gt(0) ? nextStock : new Prisma.Decimal(0)).lte(current.thresholdStock as any),
                lastRestocked: (type === "PURCHASE" || adjustment.gt(0)) ? new Date() : current.lastRestocked
            } as any
        });

        // Record Detailed Inventory Log
        await prisma.inventoryLog.create({
            data: {
                productId: current.productId,
                variantId: current.variantId,
                locationId: current.locationId,
                type: (type || "ADJUSTMENT") as any,
                beforeQty: current.currentStock,
                afterQty: Prisma.Decimal.max(0, nextStock),
                delta: adjustment,
                staffId: (req as any).user?.userId?.startsWith("STORE_") ? null : (req as any).user?.userId || null,
            }
        });

        res.json(updated);
    } catch (error: any) {
        console.error("Adjustment Failure:", error);
        res.status(500).json({ error: error.message });
    }
};

export const transferStock = async (req: Request, res: Response) => {
    const { sourceLocationId, destLocationId, items } = req.body;
    const authUser = (req as any).user;

    if (!sourceLocationId || !destLocationId || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid transfer request parameters" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const transferResults = [];

            for (const item of items) {
                const { productId, variantId, quantity } = item;
                const transferQty = new Prisma.Decimal(quantity || 0);
                const currentVariantId = variantId || null;

                // 1. Deduct from Source
                const sourceInventory = await tx.inventory.findFirst({
                    where: { 
                        productId, 
                        locationId: sourceLocationId, 
                        variantId: currentVariantId 
                    }
                });

                if (!sourceInventory || (new Prisma.Decimal(sourceInventory.currentStock as any)).lt(transferQty)) {
                    throw new Error(`Insufficient stock at sourcehub for product ${productId}. Available: ${sourceInventory?.currentStock || 0}`);
                }

                const beforeSourceStock = new Prisma.Decimal(sourceInventory.currentStock as any);
                const afterSourceStock = beforeSourceStock.minus(transferQty);

                const updatedSource = await tx.inventory.update({
                    where: { id: sourceInventory.id },
                    data: {
                        currentStock: afterSourceStock,
                        isLowStock: afterSourceStock.lte(new Prisma.Decimal(sourceInventory.thresholdStock as any))
                    }
                });

                // 2. Add to Destination
                let destInventory = await tx.inventory.findFirst({
                    where: { 
                        productId, 
                        locationId: destLocationId, 
                        variantId: currentVariantId 
                    }
                });

                let beforeDestStock = new Prisma.Decimal(0);
                let afterDestStock = transferQty;

                if (!destInventory) {
                    destInventory = await tx.inventory.create({
                        data: {
                            productId,
                            locationId: destLocationId,
                            variantId: currentVariantId,
                            currentStock: transferQty,
                            thresholdStock: 5
                        }
                    });
                } else {
                    beforeDestStock = new Prisma.Decimal(destInventory.currentStock as any);
                    afterDestStock = beforeDestStock.plus(transferQty);
                    
                    await tx.inventory.update({
                        where: { id: destInventory.id },
                        data: {
                            currentStock: afterDestStock,
                            isLowStock: afterDestStock.lte(new Prisma.Decimal(destInventory.thresholdStock as any))
                        }
                    });
                }

                // 3. Record Inventory Logs (Atomic)
                await tx.inventoryLog.create({
                    data: {
                        productId,
                        variantId: currentVariantId,
                        locationId: sourceLocationId,
                        type: "TRANSFER",
                        beforeQty: beforeSourceStock,
                        afterQty: afterSourceStock,
                        delta: transferQty.negated(),
                        staffId: authUser?.userId?.startsWith("STORE_") ? null : authUser?.userId || null
                    }
                });

                await tx.inventoryLog.create({
                    data: {
                        productId,
                        variantId: currentVariantId,
                        locationId: destLocationId,
                        type: "TRANSFER",
                        beforeQty: beforeDestStock,
                        afterQty: afterDestStock,
                        delta: transferQty,
                        staffId: authUser?.userId?.startsWith("STORE_") ? null : authUser?.userId || null
                    }
                });

                transferResults.push({ productId, quantity: transferQty.toNumber() });
            }

            return transferResults;
        });

        res.json({ message: "Inter-store movement protocol successfully executed", results: result });
    } catch (error: any) {
        console.error("Logistic Protocol Interruption:", error);
        res.status(500).json({ error: error.message });
    }
};

export const addInwardStock = async (req: Request, res: Response) => {
    const { locationId, items } = req.body;
    const authUser = (req as any).user;

    if (!locationId || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid inward request parameters" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const inwardResults = [];

            for (const item of items) {
                const { productId, variantId, quantity, costPrice } = item;
                
                // 🛡️ SANITY CHECK: Verify foreign keys BEFORE creation to prevent P2003
                const [locCheck, prodCheck, variantCheck] = await Promise.all([
                    tx.location.findUnique({ where: { id: locationId }, select: { id: true } }),
                    tx.product.findUnique({ where: { id: productId }, select: { id: true } }),
                    variantId ? tx.productVariant.findUnique({ where: { id: variantId }, select: { id: true } }) : Promise.resolve(true)
                ]);

                if (!locCheck) throw new Error(`Invalid Location ID: ${locationId}`);
                if (!prodCheck) throw new Error(`Invalid Product ID: ${productId}`);
                if (variantId && !variantCheck) {
                    console.warn(`[INWARD] Skipping stale variant ID: ${variantId} for product ${productId}. Reverting to base product.`);
                }

                const inwardQty = new Prisma.Decimal(quantity);
                const inwardPrice = new Prisma.Decimal(costPrice || 0);

                // 1. Update/Create Inventory Node
                const currentVariantId = (variantId && variantCheck) ? variantId : null;
                
                let inventory = await tx.inventory.findFirst({
                    where: { productId, locationId, variantId: currentVariantId }
                });

                let beforeQty = new Prisma.Decimal(0);

                if (!inventory) {
                    inventory = await tx.inventory.create({
                        data: {
                            productId,
                            locationId,
                            variantId: currentVariantId,
                            currentStock: inwardQty,
                            thresholdStock: 5
                        }
                    });
                } else {
                    beforeQty = new Prisma.Decimal(inventory.currentStock as any);
                    inventory = await tx.inventory.update({
                        where: { id: inventory.id },
                        data: {
                            currentStock: { increment: inwardQty },
                            isLowStock: beforeQty.plus(inwardQty).lte(inventory.thresholdStock as any),
                            lastRestocked: new Date()
                        }
                    });
                }

                // 2. Create Batch Record
                let validatedStaffId: string | null = null;
                if (authUser?.userId) {
                    const staffExists = await tx.user.findUnique({ 
                        where: { id: authUser.userId },
                        select: { id: true }
                    });
                    if (staffExists) validatedStaffId = authUser.userId;
                }

                const batch = await tx.batch.create({
                    data: {
                        productId,
                        variantId: currentVariantId,
                        locationId,
                        batchNumber: `INW_${Date.now()}_${Math.random().toString(36).slice(-4).toUpperCase()}`,
                        costPrice: inwardPrice,
                        initialQty: inwardQty,
                        remainingQty: inwardQty,
                        staffId: validatedStaffId
                    }
                });

                // 3. Record Inventory Log
                await tx.inventoryLog.create({
                    data: {
                        productId,
                        variantId: currentVariantId,
                        locationId,
                        batchId: batch.id,
                        type: "PURCHASE",
                        beforeQty: beforeQty,
                        afterQty: inventory.currentStock,
                        delta: inwardQty,
                        staffId: validatedStaffId
                    }
                });

                inwardResults.push({ productId, batchId: batch.id });
            }

            return inwardResults;
        });

        res.json({ message: "Inward stock entries processed successfully", results: result });
    } catch (error: any) {
        console.error("CRITICAL INWARD FAILURE:", {
            error: error.message,
            stack: error.stack,
            meta: error.meta,
            code: error.code
        });
        res.status(500).json({ 
            error: "Inward processing failed", 
            details: error.message,
            code: error.code 
        });
    }
};

export const recordMortality = async (req: Request, res: Response) => {
    const { productId, variantId, locationId, quantity, reason, price } = req.body;
    const authUser = (req as any).user;

    if (!locationId || !productId || !quantity) {
        return res.status(400).json({ message: "Invalid mortality parameters" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const mortQty = new Prisma.Decimal(quantity);
            let remainingToDeduct = new Prisma.Decimal(quantity);

            // PHASE 1: Fetch Batches with Variant Fallback
            let batches = await tx.batch.findMany({
                where: { 
                    productId, 
                    variantId: variantId || null, 
                    locationId, 
                    remainingQty: { gt: 0 } 
                },
                orderBy: { receivedDate: 'asc' }
            });

            // FALLBACK: If variant stock requested but empty, check base product stock
            if (batches.length === 0 && variantId) {
                console.log(`[MORTALITY] Variant ${variantId} empty, falling back to base product ${productId}`);
                batches = await tx.batch.findMany({
                    where: { 
                        productId, 
                        variantId: null, 
                        locationId, 
                        remainingQty: { gt: 0 } 
                    },
                    orderBy: { receivedDate: 'asc' }
                });
            }

            if (batches.length === 0) {
                throw new Error("No available stock batches found for this product node or its base merchandise in the selected hub. Please verify inward stock records.");
            }

            let totalDeducted = new Prisma.Decimal(0);

            for (const batch of batches) {
                if (remainingToDeduct.lte(0)) break;

                const batchStock = new Prisma.Decimal(batch.remainingQty as any);
                const deduct = Prisma.Decimal.min(batchStock, remainingToDeduct);

                // Deduct from Batch and capture the effective cost being lost
                await tx.batch.update({
                    where: { id: batch.id },
                    data: { remainingQty: { decrement: deduct } }
                });

                const costPrice = price !== undefined ? new Prisma.Decimal(price) : new Prisma.Decimal(batch.costPrice as any);
                const lossAmount = costPrice.mul(deduct);

                await tx.mortalityLog.create({
                    data: {
                        productId,
                        variantId: variantId || null,
                        batchId: batch.id,
                        locationId,
                        reason: reason || "SPOILAGE",
                        quantity: deduct,
                        costPrice: costPrice,
                        totalLoss: lossAmount,
                        staffId: (authUser?.userId && !authUser.userId.startsWith("STORE_")) ? authUser.userId : null
                    }
                });

                remainingToDeduct = remainingToDeduct.minus(deduct);
                totalDeducted = totalDeducted.plus(deduct);
            }

            if (totalDeducted.lte(0)) {
                throw new Error("Could not reconcile any wastage against existing batches. Stock levels might already be zero.");
            }

            // Update Global Stock Node with Variant Fallback
            let inventory = await tx.inventory.findFirst({
                where: { productId, variantId: variantId || null, locationId }
            });

            // FALLBACK: If no inventory on variant, update base product inventory
            if ((!inventory || inventory.currentStock.lessThanOrEqualTo(0)) && variantId) {
                inventory = await tx.inventory.findFirst({
                    where: { productId, variantId: null, locationId }
                });
            }

            if (inventory) {
                const before = new Prisma.Decimal(inventory.currentStock as any);
                const after = before.minus(totalDeducted).gt(0) ? before.minus(totalDeducted) : new Prisma.Decimal(0);
                
                await tx.inventory.update({
                    where: { id: inventory.id },
                    data: { 
                        currentStock: after,
                        isLowStock: after.lte(new Prisma.Decimal(inventory.thresholdStock as any))
                    }
                });

                // Detailed Audit Log
                await tx.inventoryLog.create({
                    data: {
                        productId,
                        variantId: variantId || null,
                        locationId,
                        type: "SPOILAGE",
                        beforeQty: before,
                        afterQty: after,
                        delta: totalDeducted.negated(),
                        staffId: (authUser?.userId && !authUser.userId.startsWith("STORE_")) ? authUser.userId : null
                    }
                });
            }

            return { success: true, reconciled: mortQty.minus(remainingToDeduct) };
        });

        res.json(result);
    } catch (error: any) {
        console.error("[MORTALITY] Error:", error.message);
        res.status(400).json({ 
            message: error.message || "Failed to process mortality reconciliation",
            code: "MORTALITY_RECON_FAILED"
        });
    }
};

export const getMortalityHistory = async (req: Request, res: Response) => {
    const { locationId } = req.params;
    try {
        const logs = await prisma.mortalityLog.findMany({
            where: { locationId: locationId as string },
            include: {
                product: { select: { name: true } },
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getInwardHistory = async (req: Request, res: Response) => {
    const { locationId } = req.params;
    try {
        const batches = await prisma.batch.findMany({
            where: { locationId: locationId as string },
            include: {
                product: { select: { name: true, sku: true } },
                variant: { select: { name: true } },
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 100
        });
        res.json(batches);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
