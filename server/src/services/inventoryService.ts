
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { StockError } from "../utils/errors";

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

        const invRows: any[] = await db.$queryRaw`
            SELECT id, "currentStock" 
            FROM "Inventory" 
            WHERE "productId" = ${params.productId} 
              AND "locationId" = ${params.locationId} 
              ${variantQuery}
            FOR UPDATE
        `;

        let currentStock = 0;
        let invId: string | null = null;

        if (!invRows || invRows.length === 0) {
            if (params.qtyDelta < 0) {
                throw new StockError(`Inventory record not found for product ${params.productId}`);
            }
            const newInv = await db.inventory.create({
                data: {
                    productId: params.productId,
                    locationId: params.locationId,
                    variantId: params.variantId || null,
                    currentStock: params.qtyDelta
                }
            });
            invId = newInv.id;
            currentStock = 0;
        } else {
            invId = invRows[0].id;
            currentStock = invRows[0].currentStock;

            if (currentStock + params.qtyDelta < 0) {
                throw new StockError(`Insufficient actual stock for product ${params.productId}. Required: ${Math.abs(params.qtyDelta)}, Available: ${currentStock}`);
            }

            await db.$executeRaw`
                UPDATE "Inventory" 
                SET "currentStock" = "currentStock" + ${params.qtyDelta}, "updatedAt" = NOW()
                WHERE id = ${invId}
            `;
        }

        const newStock = currentStock + params.qtyDelta;

        await db.$executeRaw`
            INSERT INTO "InventoryLedger" (
                "id", "storeId", "productId", "referenceType", "referenceId", 
                "quantityChange", "previousQuantity", "newQuantity", "createdAt", "createdBy"
            ) VALUES (
                gen_random_uuid(), ${params.locationId}, ${params.productId}, 
                CAST(${params.referenceType} AS "InventoryLedgerReferenceType"), COALESCE(${params.referenceId || null}, 'N/A'), 
                ${params.qtyDelta}, ${currentStock}, ${newStock}, NOW(), COALESCE(${params.staffId || null}, 'SYSTEM')
            )
        `;

        // Automated Website Sync if dropping to 0 or rising above 0 globally
        const globalInventory = await db.inventory.aggregate({
            where: { productId: params.productId },
            _sum: { currentStock: true }
        });
        const totalStock = Number(globalInventory._sum.currentStock || 0);
        await db.product.update({
            where: { id: params.productId },
            data: { isWebsitePublished: totalStock > 0, version: { increment: 1 } }
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
        journalId?: string;
        staffId?: string;
    }, tx?: any) {
        const executeLogic = async (db: any) => {
            for (const item of params.items) {
                const qtyToDeduct = new Prisma.Decimal(item.quantity);
                let remainingToDeduct = qtyToDeduct;

                // 1. Fetch available batches for this product/location ordered by FIFO (receivedDate)
                const batches = await db.batch.findMany({
                    where: {
                        productId: item.productId,
                        variantId: item.variantId || null,
                        locationId: params.locationId,
                        remainingQty: { gt: 0 }
                    },
                    orderBy: { receivedDate: "asc" }
                });

                console.log(`[FIFO] Found ${batches.length} batches for product ${item.productId}. Total required: ${qtyToDeduct}`);

                const totalAvailable = batches.reduce((acc: Prisma.Decimal, b: any) => acc.plus(b.remainingQty), new Prisma.Decimal(0));
                if (totalAvailable.lessThan(qtyToDeduct)) {
                    throw new StockError(`Insufficient stock for product ${item.productId}. Required: ${qtyToDeduct}, Available: ${totalAvailable}`);
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

                    await db.inventoryLog.create({
                        data: {
                            product: { connect: { id: item.productId } },
                            variant: item.variantId ? { connect: { id: item.variantId } } : undefined,
                            batch: { connect: { id: batch.id } },
                            location: { connect: { id: params.locationId } },
                            type: params.type,
                            beforeQty,
                            afterQty,
                            delta: deductionFromBatch.negated(),
                            journal: params.journalId ? { connect: { id: params.journalId } } : undefined,
                            staff: params.staffId ? { connect: { id: params.staffId } } : undefined
                        }
                    });

                    remainingToDeduct = remainingToDeduct.minus(deductionFromBatch);
                }

                // Determine ledger reference type
                let refType: 'ORDER' | 'REFUND' | 'MORTALITY' | 'ADJUSTMENT' = 'ADJUSTMENT';
                if (params.type === InventoryLogType.SALE) refType = 'ORDER';
                if (params.type === InventoryLogType.RETURN) refType = 'REFUND';
                if (params.type === InventoryLogType.DAMAGE) refType = 'MORTALITY';
                if (params.type === InventoryLogType.ADJUSTMENT) refType = 'ADJUSTMENT';

                // 4. Update Global Inventory Snapshot via centralized locking wrapper
                await InventoryService.adjustGlobalInventory(db, {
                    productId: item.productId,
                    variantId: item.variantId,
                    locationId: params.locationId,
                    qtyDelta: -qtyToDeduct.toNumber(),
                    referenceType: refType,
                    referenceId: params.journalId,
                    staffId: params.staffId
                });
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
                staff: params.staffId ? { connect: { id: params.staffId } } : undefined
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
                    staff: params.staffId ? { connect: { id: params.staffId } } : undefined
                }
            });

            // Update Global Inventory Snapshot via locked wrapper
            // If spoilage, qtyDelta is 0 (inventory doesn't return to sellable pool)
            await InventoryService.adjustGlobalInventory(db, {
                productId: item.productId,
                variantId: item.variantId,
                locationId: params.locationId,
                qtyDelta: isSpoilage ? 0 : qty.toNumber(),
                referenceType: isSpoilage ? 'SPOILAGE' : 'REFUND',
                referenceId: params.referenceId,
                staffId: params.staffId
            });
        }
    }

    /**
     * Shim for legacy reserveStock. 
     */
    static async reserveStock(tx: any, items: any[]) {
        console.log("[InventoryService] reserveStock called (Placeholder)");
        return;
    }
}