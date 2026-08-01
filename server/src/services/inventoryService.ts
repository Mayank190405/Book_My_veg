
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { StockError } from "../utils/errors";
import { convertVariantToBaseQuantity } from "../utils/unitConverter";

export enum InventoryLogType {
    SALE = "SALE",
    PURCHASE = "PURCHASE",
    RETURN = "RETURN",
    DAMAGE = "DAMAGE",
    SPOILAGE = "SPOILAGE",
    ADJUSTMENT = "ADJUSTMENT",
    TRANSFER = "TRANSFER"
}

export interface StockDeductionItem {
    productId: string;
    variantId?: string;
    quantity: number | Prisma.Decimal;
}

export class InventoryService {
    /**
     * Unified method to safely MUTATE global inventory with row-locks and Ledger append.
     * This guarantees Phase 1 constraints: No oversell (DB CHECK), row locks, and ledgering.
     */
    static async adjustGlobalInventory(db: any, params: {
        productId: string;
        variantId?: string;
        locationId: string;
        qtyDelta: number; // positive for addition/restore, negative for deduction
        referenceType: 'ORDER' | 'REFUND' | 'MORTALITY' | 'ADJUSTMENT' | 'SPOILAGE';
        referenceId?: string;
        staffId?: string;
    }) {
        const variantQuery = params.variantId ? Prisma.sql`AND "variantId" = ${params.variantId}` : Prisma.sql`AND "variantId" IS NULL`;

        let invRows: any[] = await db.$queryRaw`
            SELECT id, "currentStock" 
            FROM "Inventory" 
            WHERE "productId" = ${params.productId} 
              AND "locationId" = ${params.locationId} 
              ${variantQuery}
            FOR UPDATE
        `;

        // Fallback to Base Product Main Inventory (variantId IS NULL) if variant inventory row is missing
        if ((!invRows || invRows.length === 0) && params.variantId) {
            invRows = await db.$queryRaw`
                SELECT id, "currentStock" 
                FROM "Inventory" 
                WHERE "productId" = ${params.productId} 
                  AND "locationId" = ${params.locationId} 
                  AND "variantId" IS NULL
                FOR UPDATE
            `;
        }

        let currentStock = 0;
        let invId: string | null = null;

        if (!invRows || invRows.length === 0) {
            // Reconcile from Batches if missing
            const batchSummary: any = await db.batch.aggregate({
                where: {
                    productId: params.productId,
                    locationId: params.locationId,
                    variantId: params.variantId || null
                },
                _sum: { remainingQty: true }
            });

            currentStock = Number(batchSummary._sum.remainingQty || 0);

            const newInv = await db.inventory.create({
                data: {
                    productId: params.productId,
                    locationId: params.locationId,
                    variantId: params.variantId || null,
                    currentStock: currentStock
                }
            });
            invId = newInv.id;
            // No need to apply delta below as it's already reflected in the Batch SUM we just queried
        } else {
        let effectiveQtyDelta = params.qtyDelta;
        if (params.variantId) {
            const [product, variant] = await Promise.all([
                db.product.findUnique({ where: { id: params.productId }, select: { weightUnit: true } }),
                db.productVariant.findUnique({ where: { id: params.variantId }, select: { weight: true, weightUnit: true } })
            ]);
            if (product && variant) {
                const isDeduction = params.qtyDelta < 0;
                const absQty = Math.abs(params.qtyDelta);
                const baseUnits = convertVariantToBaseQuantity(variant.weight, variant.weightUnit, product.weightUnit, absQty);
                effectiveQtyDelta = isDeduction ? -baseUnits : baseUnits;
            }
        }

        invId = invRows[0].id;
        const existingStock = new Prisma.Decimal(invRows[0].currentStock);
        const delta = new Prisma.Decimal(effectiveQtyDelta);

        if (existingStock.plus(delta).isNegative()) {
            throw new StockError(`Insufficient actual stock for product ${params.productId}. Required: ${delta.abs()}, Available: ${existingStock}`);
        }

        // Apply atomic delta to existing record using native Prisma increment/decrement
        const updatedInv = await db.inventory.update({
            where: { id: invId },
            data: {
                currentStock: { increment: delta },
                updatedAt: new Date()
            }
        });
        currentStock = updatedInv.currentStock;
    }

    const newStock = currentStock;

    // Use a valid InventoryLedgerReferenceType
    let safeRefType: any = params.referenceType;
    const validRefTypes = ["ORDER", "REFUND", "MORTALITY", "ADJUSTMENT"];
    if (!validRefTypes.includes(safeRefType)) {
        safeRefType = "ADJUSTMENT";
    }

    await db.inventoryLedger.create({
        data: {
            storeId: params.locationId,
            productId: params.productId,
            referenceType: safeRefType,
            referenceId: params.referenceId || "N/A",
            quantityChange: new Prisma.Decimal(params.qtyDelta),
            previousQuantity: (new Prisma.Decimal(currentStock as any)).minus(new Prisma.Decimal(params.qtyDelta)),
            newQuantity: new Prisma.Decimal(currentStock as any),
            createdBy: params.staffId || "SYSTEM"
        }
    });
        // Automated Website Sync if dropping to 0 or rising above 0 globally
        const globalInventory = await db.inventory.aggregate({
            where: { productId: params.productId },
            _sum: { currentStock: true }
        });
        const totalStock = new Prisma.Decimal(globalInventory._sum.currentStock || 0);
        await db.product.update({
            where: { id: params.productId },
            data: { isWebsitePublished: totalStock.gt(0), version: { increment: 1 } }
        });

        return { currentStock: newStock };
    }
    /**
     * Deducts stock using FIFO batch logic.
     * Must be called within a Prisma transaction.
     */
    static async deductStock(params: {
        items: StockDeductionItem[];
        locationId: string;
        type: InventoryLogType;
        staffId?: string;
    }, tx?: any) {
        const executeLogic = async (db: any) => {
            for (const item of params.items) {
                let baseQtyRequired = Number(item.quantity);

                if (item.variantId) {
                    const [product, variant] = await Promise.all([
                        db.product.findUnique({ where: { id: item.productId }, select: { weightUnit: true } }),
                        db.productVariant.findUnique({ where: { id: item.variantId }, select: { weight: true, weightUnit: true } })
                    ]);
                    if (product && variant) {
                        baseQtyRequired = convertVariantToBaseQuantity(variant.weight, variant.weightUnit, product.weightUnit, Number(item.quantity));
                    }
                }

                const qtyToDeduct = new Prisma.Decimal(baseQtyRequired);
                let remainingToDeduct = qtyToDeduct;

                // 1. Fetch available batches for this product/location ordered by FIFO (receivedDate)
                let batches = await db.batch.findMany({
                    where: {
                        productId: item.productId,
                        locationId: params.locationId,
                        remainingQty: { gt: 0 }
                    },
                    orderBy: { receivedDate: "asc" }
                });

                // Calculate total available in batches
                let totalAvailable = batches.reduce((acc: Prisma.Decimal, b: any) => acc.plus(b.remainingQty), new Prisma.Decimal(0));

                // ── SELF-HEALING: Reconcile with Master Inventory if batches are insufficient ── 
                if (totalAvailable.lessThan(qtyToDeduct)) {
                    const masterInv = await db.inventory.findFirst({
                        where: {
                            productId: item.productId,
                            locationId: params.locationId,
                            currentStock: { gt: 0 }
                        }
                    });

                    if (masterInv && new Prisma.Decimal(masterInv.currentStock).greaterThan(totalAvailable)) {
                        const missingQty = new Prisma.Decimal(masterInv.currentStock).minus(totalAvailable);
                        console.log(`[FIFO-FIX] Detected Batch/Inventory mismatch for product ${item.productId}. Inventory: ${masterInv.currentStock}, Batches: ${totalAvailable}. Recovering ${missingQty} into new batch.`);
                        
                        const recoveredBatch = await db.batch.create({
                            data: {
                                batchNumber: `RECOVERED_${Date.now()}`,
                                productId: item.productId,
                                variantId: item.variantId || null,
                                locationId: params.locationId,
                                initialQty: missingQty,
                                remainingQty: missingQty,
                                costPrice: 0 
                            }
                        });
                        batches.push(recoveredBatch);
                        totalAvailable = totalAvailable.plus(missingQty);
                    }
                }

                console.log(`[FIFO] Final batch count for ${item.productId}: ${batches.length}. Total Available: ${totalAvailable}, Required: ${qtyToDeduct}`);

                if (totalAvailable.lessThan(qtyToDeduct)) {
                    console.error(`[STOCK-FAIL] Product: ${item.productId}, Variant: ${item.variantId || 'NONE'}, Location: ${params.locationId}, Required: ${qtyToDeduct}, Available: ${totalAvailable}`);
                    throw new StockError(`Insufficient balance for product ${item.productId}. Requested: ${qtyToDeduct}, System has: ${totalAvailable}. Please update stock via Purchase/Adjustment.`);
                }

                // 2. Iterate through batches and deduct
                for (const batch of batches) {
                    if (remainingToDeduct.isZero()) break;

                    const deductionFromBatch = Prisma.Decimal.min(batch.remainingQty as Prisma.Decimal, remainingToDeduct);
                    console.log(`[FIFO] Deducting ${deductionFromBatch} from batch ${batch.batchNumber} (Available: ${batch.remainingQty})`);

                    // Optimistic locking update
                    const updatedBatch = await db.batch.updateMany({
                        where: {
                            id: batch.id,
                            version: batch.version // Ensure no concurrent modification
                        },
                        data: {
                            remainingQty: { decrement: deductionFromBatch },
                            version: { increment: 1 }
                        }
                    });

                    if (updatedBatch.count === 0) {
                        throw new Error(`Concurrency conflict during stock deduction for batch ${batch.id}. Please retry.`);
                    }

                    // 3. Create InventoryLog for this batch deduction
                    const beforeQty = batch.remainingQty as Prisma.Decimal;
                    const afterQty = beforeQty.minus(deductionFromBatch);

                    const prismaStaffId = (params.staffId && !params.staffId.startsWith("STORE_") && params.staffId !== "SYSTEM") ? params.staffId : undefined;

                    await db.inventoryLog.create({
                        data: {
                            product: { connect: { id: item.productId } },
                            variant: batch.variantId ? { connect: { id: batch.variantId } } : undefined,
                            batch: { connect: { id: batch.id } },
                            location: { connect: { id: params.locationId } },
                            type: params.type,
                            beforeQty,
                            afterQty,
                            delta: deductionFromBatch.negated(),
                            staff: prismaStaffId ? { connect: { id: prismaStaffId } } : undefined
                        }
                    });

                    // Determine ledger reference type
                    let refType: 'ORDER' | 'REFUND' | 'MORTALITY' | 'ADJUSTMENT' = 'ADJUSTMENT';
                    if (params.type === InventoryLogType.SALE) refType = 'ORDER';
                    if (params.type === InventoryLogType.RETURN) refType = 'REFUND';
                    if (params.type === InventoryLogType.DAMAGE) refType = 'MORTALITY';
                    if (params.type === InventoryLogType.ADJUSTMENT) refType = 'ADJUSTMENT';

                    // 4. Update Global Inventory Snapshot via centralized locking wrapper
                    // We must deduct from THAT SPECIFIC batch's variant globally
                    await InventoryService.adjustGlobalInventory(db, {
                        productId: item.productId,
                        variantId: batch.variantId || undefined,
                        locationId: params.locationId,
                        qtyDelta: -deductionFromBatch.toNumber(),
                        referenceType: refType,
                        staffId: params.staffId
                    });

                    remainingToDeduct = remainingToDeduct.minus(deductionFromBatch);
                }
            }
        };

        if (tx) {
            await executeLogic(tx);
        } else {
            // Apply strict Repeatable Read isolation for concurrency safety
            await prisma.$transaction(executeLogic, {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead
            });
        }
    }

    /**
     * Adds stock into a new batch.
     */
    static async addStock(params: {
        productId: string;
        variantId?: string;
        locationId: string;
        quantity: number | Prisma.Decimal;
        costPrice: number | Prisma.Decimal;
        batchNumber: string;
        expiryDate?: Date;
        staffId?: string;
    }, tx?: any) {
        const db = tx || prisma;
        const qty = new Prisma.Decimal(params.quantity);

        // 1. Create the Batch
        const batch = await db.batch.create({
            data: {
                product: { connect: { id: params.productId } },
                variant: params.variantId ? { connect: { id: params.variantId } } : undefined,
                location: { connect: { id: params.locationId } },
                batchNumber: params.batchNumber,
                costPrice: params.costPrice,
                initialQty: qty,
                remainingQty: qty,
                expiryDate: params.expiryDate
            }
        });

        // 2. Fetch current inventory for log (Use findFirst for robust null handling)
        const inv = await db.inventory.findFirst({
            where: {
                productId: params.productId,
                locationId: params.locationId,
                variantId: params.variantId || null
            }
        });

        const beforeQty = new Prisma.Decimal(inv?.currentStock || 0);
        const afterQty = beforeQty.plus(qty);

        const prismaStaffId = (params.staffId && !params.staffId.startsWith("STORE_") && params.staffId !== "SYSTEM") ? params.staffId : undefined;

        // 3. Create InventoryLog
        await db.inventoryLog.create({
            data: {
                product: { connect: { id: params.productId } },
                variant: params.variantId ? { connect: { id: params.variantId } } : undefined,
                batch: { connect: { id: batch.id } },
                location: { connect: { id: params.locationId } },
                type: InventoryLogType.PURCHASE,
                beforeQty,
                afterQty,
                delta: qty,
                staff: prismaStaffId ? { connect: { id: prismaStaffId } } : undefined
            }
        });

        // 4. Update Global Inventory via locked wrapper
        await InventoryService.adjustGlobalInventory(db, {
            productId: params.productId,
            variantId: params.variantId,
            locationId: params.locationId,
            qtyDelta: qty.toNumber(),
            referenceType: 'ADJUSTMENT', // Using ADJUSTMENT or PURCHASE equivalency in strict enum
            referenceId: batch.id,
            staffId: params.staffId
        });
    }

    /**
     * Restores stock (e.g., on order cancellation or refund).
     * If isSpoilage is true, records the loss without increasing sellable inventory.
     */
    static async restoreStock(params: {
        items: (StockDeductionItem & { isSpoilage?: boolean })[];
        locationId: string;
        staffId?: string;
        referenceId: string;
    }, tx: any) {
        const db = tx || prisma;

        for (const item of params.items) {
            const qty = new Prisma.Decimal(item.quantity);
            const isSpoilage = item.isSpoilage || false;

            // Find the most recent batch for this product/location to associate the log
            const latestBatch = await db.batch.findFirst({
                where: {
                    productId: item.productId,
                    variantId: item.variantId || null,
                    locationId: params.locationId
                },
                orderBy: { receivedDate: "desc" }
            });

            if (!latestBatch) {
                // Should theoretically not happen for a refund, but handle gracefully
                console.warn(`[InventoryService] No batch found for product ${item.productId} during restore.`);
            }

            if (!isSpoilage && latestBatch) {
                // Resellable: Increment batch stock
                await db.batch.update({
                    where: { id: latestBatch.id },
                    data: {
                        remainingQty: { increment: qty },
                        version: { increment: 1 }
                    }
                });
            }

            const prismaStaffId = (params.staffId && !params.staffId.startsWith("STORE_") && params.staffId !== "SYSTEM") ? params.staffId : undefined;

            // Create InventoryLog
            await db.inventoryLog.create({
                data: {
                    product: { connect: { id: item.productId } },
                    variant: item.variantId ? { connect: { id: item.variantId } } : undefined,
                    batch: latestBatch ? { connect: { id: latestBatch.id } } : undefined,
                    location: { connect: { id: params.locationId } },
                    type: isSpoilage ? InventoryLogType.SPOILAGE : InventoryLogType.RETURN,
                    beforeQty: latestBatch?.remainingQty || 0,
                    afterQty: isSpoilage
                        ? (latestBatch?.remainingQty || 0)
                        : (latestBatch ? (latestBatch.remainingQty as Prisma.Decimal).plus(qty) : 0),
                    delta: isSpoilage ? new Prisma.Decimal(0) : qty,
                    staff: prismaStaffId ? { connect: { id: prismaStaffId } } : undefined
                }
            });

            // Update Global Inventory Snapshot via locked wrapper
            // If spoilage, qtyDelta is 0 (inventory doesn't return to sellable pool)
            await InventoryService.adjustGlobalInventory(db, {
                productId: item.productId,
                variantId: item.variantId,
                locationId: params.locationId,
                qtyDelta: isSpoilage ? 0 : qty.toNumber(),
                referenceType: isSpoilage ? 'MORTALITY' : 'REFUND',
                referenceId: params.referenceId,
                staffId: params.staffId
            });
        }
    }


    /**
     * Real stock reservation – deducts from batches immediately.
     * Use this for Web/WhatsApp orders to prevent overselling while paying.
     */
    static async reserveStock(params: {
        items: StockDeductionItem[];
        locationId: string;
        staffId?: string;
    }, tx?: any) {
        // We reuse deductStock logic but with a specific reference
        return await InventoryService.deductStock({
            ...params,
            type: InventoryLogType.SALE // Use SALE for now to match DB schema enum
        }, tx);
    }
}
