"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = exports.InventoryLogType = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const errors_1 = require("../utils/errors");
var InventoryLogType;
(function (InventoryLogType) {
    InventoryLogType["SALE"] = "SALE";
    InventoryLogType["PURCHASE"] = "PURCHASE";
    InventoryLogType["RETURN"] = "RETURN";
    InventoryLogType["DAMAGE"] = "DAMAGE";
    InventoryLogType["SPOILAGE"] = "SPOILAGE";
    InventoryLogType["ADJUSTMENT"] = "ADJUSTMENT";
    InventoryLogType["TRANSFER"] = "TRANSFER";
})(InventoryLogType || (exports.InventoryLogType = InventoryLogType = {}));
class InventoryService {
    /**
     * Unified method to safely MUTATE global inventory with row-locks and Ledger append.
     * This guarantees Phase 1 constraints: No oversell (DB CHECK), row locks, and ledgering.
     */
    static adjustGlobalInventory(db, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const variantQuery = params.variantId ? client_1.Prisma.sql `AND "variantId" = ${params.variantId}` : client_1.Prisma.sql `AND "variantId" IS NULL`;
            let invRows = yield db.$queryRaw `
            SELECT id, "currentStock" 
            FROM "Inventory" 
            WHERE "productId" = ${params.productId} 
              AND "locationId" = ${params.locationId} 
              ${variantQuery}
            FOR UPDATE
        `;
            // Fallback to Base Product Main Inventory (variantId IS NULL) if variant inventory row is missing
            if ((!invRows || invRows.length === 0) && params.variantId) {
                invRows = yield db.$queryRaw `
                SELECT id, "currentStock" 
                FROM "Inventory" 
                WHERE "productId" = ${params.productId} 
                  AND "locationId" = ${params.locationId} 
                  AND "variantId" IS NULL
                FOR UPDATE
            `;
            }
            let currentStock = 0;
            let invId = null;
            if (!invRows || invRows.length === 0) {
                // Reconcile from Batches if missing
                const batchSummary = yield db.batch.aggregate({
                    where: {
                        productId: params.productId,
                        locationId: params.locationId,
                        variantId: params.variantId || null
                    },
                    _sum: { remainingQty: true }
                });
                currentStock = Number(batchSummary._sum.remainingQty || 0);
                const newInv = yield db.inventory.create({
                    data: {
                        productId: params.productId,
                        locationId: params.locationId,
                        variantId: params.variantId || null,
                        currentStock: currentStock
                    }
                });
                invId = newInv.id;
                // No need to apply delta below as it's already reflected in the Batch SUM we just queried
            }
            else {
                invId = invRows[0].id;
                const existingStock = new client_1.Prisma.Decimal(invRows[0].currentStock);
                const delta = new client_1.Prisma.Decimal(params.qtyDelta);
                if (existingStock.plus(delta).isNegative()) {
                    throw new errors_1.StockError(`Insufficient actual stock for product ${params.productId}. Required: ${delta.abs()}, Available: ${existingStock}`);
                }
                // Apply atomic delta to existing record using native Prisma increment/decrement
                const updatedInv = yield db.inventory.update({
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
            let safeRefType = params.referenceType;
            const validRefTypes = ["ORDER", "REFUND", "MORTALITY", "ADJUSTMENT"];
            if (!validRefTypes.includes(safeRefType)) {
                safeRefType = "ADJUSTMENT";
            }
            yield db.inventoryLedger.create({
                data: {
                    storeId: params.locationId,
                    productId: params.productId,
                    referenceType: safeRefType,
                    referenceId: params.referenceId || "N/A",
                    quantityChange: new client_1.Prisma.Decimal(params.qtyDelta),
                    previousQuantity: (new client_1.Prisma.Decimal(currentStock)).minus(new client_1.Prisma.Decimal(params.qtyDelta)),
                    newQuantity: new client_1.Prisma.Decimal(currentStock),
                    createdBy: params.staffId || "SYSTEM"
                }
            });
            // Automated Website Sync if dropping to 0 or rising above 0 globally
            const globalInventory = yield db.inventory.aggregate({
                where: { productId: params.productId },
                _sum: { currentStock: true }
            });
            const totalStock = new client_1.Prisma.Decimal(globalInventory._sum.currentStock || 0);
            yield db.product.update({
                where: { id: params.productId },
                data: { isWebsitePublished: totalStock.gt(0), version: { increment: 1 } }
            });
            return { currentStock: newStock };
        });
    }
    /**
     * Deducts stock using FIFO batch logic.
     * Must be called within a Prisma transaction.
     */
    static deductStock(params, tx) {
        return __awaiter(this, void 0, void 0, function* () {
            const executeLogic = (db) => __awaiter(this, void 0, void 0, function* () {
                for (const item of params.items) {
                    const qtyToDeduct = new client_1.Prisma.Decimal(item.quantity);
                    let remainingToDeduct = qtyToDeduct;
                    // 1. Fetch available batches for this product/location ordered by FIFO (receivedDate)
                    let batches = yield db.batch.findMany({
                        where: {
                            productId: item.productId,
                            variantId: item.variantId || null,
                            locationId: params.locationId,
                            remainingQty: { gt: 0 }
                        },
                        orderBy: { receivedDate: "asc" }
                    });
                    // Calculate total available in batches
                    let totalAvailable = batches.reduce((acc, b) => acc.plus(b.remainingQty), new client_1.Prisma.Decimal(0));
                    // ── SELF-HEALING: Reconcile with Master Inventory if batches are insufficient ── 
                    if (totalAvailable.lessThan(qtyToDeduct)) {
                        const masterInv = yield db.inventory.findFirst({
                            where: Object.assign(Object.assign({ productId: item.productId, locationId: params.locationId }, (item.variantId ? { variantId: item.variantId } : {})), { currentStock: { gt: 0 } })
                        });
                        if (masterInv && new client_1.Prisma.Decimal(masterInv.currentStock).greaterThan(totalAvailable)) {
                            const missingQty = new client_1.Prisma.Decimal(masterInv.currentStock).minus(totalAvailable);
                            console.log(`[FIFO-FIX] Detected Batch/Inventory mismatch for product ${item.productId}. Inventory: ${masterInv.currentStock}, Batches: ${totalAvailable}. Recovering ${missingQty} into new batch.`);
                            const recoveredBatch = yield db.batch.create({
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
                        throw new errors_1.StockError(`Insufficient balance for product ${item.productId}. Requested: ${qtyToDeduct}, System has: ${totalAvailable}. Please update stock via Purchase/Adjustment.`);
                    }
                    // 2. Iterate through batches and deduct
                    for (const batch of batches) {
                        if (remainingToDeduct.isZero())
                            break;
                        const deductionFromBatch = client_1.Prisma.Decimal.min(batch.remainingQty, remainingToDeduct);
                        console.log(`[FIFO] Deducting ${deductionFromBatch} from batch ${batch.batchNumber} (Available: ${batch.remainingQty})`);
                        // Optimistic locking update
                        const updatedBatch = yield db.batch.updateMany({
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
                        const beforeQty = batch.remainingQty;
                        const afterQty = beforeQty.minus(deductionFromBatch);
                        const prismaStaffId = (params.staffId && !params.staffId.startsWith("STORE_") && params.staffId !== "SYSTEM") ? params.staffId : undefined;
                        yield db.inventoryLog.create({
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
                        let refType = 'ADJUSTMENT';
                        if (params.type === InventoryLogType.SALE)
                            refType = 'ORDER';
                        if (params.type === InventoryLogType.RETURN)
                            refType = 'REFUND';
                        if (params.type === InventoryLogType.DAMAGE)
                            refType = 'MORTALITY';
                        if (params.type === InventoryLogType.ADJUSTMENT)
                            refType = 'ADJUSTMENT';
                        // 4. Update Global Inventory Snapshot via centralized locking wrapper
                        // We must deduct from THAT SPECIFIC batch's variant globally
                        yield InventoryService.adjustGlobalInventory(db, {
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
            });
            if (tx) {
                yield executeLogic(tx);
            }
            else {
                // Apply strict Repeatable Read isolation for concurrency safety
                yield prisma_1.default.$transaction(executeLogic, {
                    isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead
                });
            }
        });
    }
    /**
     * Adds stock into a new batch.
     */
    static addStock(params, tx) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = tx || prisma_1.default;
            const qty = new client_1.Prisma.Decimal(params.quantity);
            // 1. Create the Batch
            const batch = yield db.batch.create({
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
            const inv = yield db.inventory.findFirst({
                where: {
                    productId: params.productId,
                    locationId: params.locationId,
                    variantId: params.variantId || null
                }
            });
            const beforeQty = new client_1.Prisma.Decimal((inv === null || inv === void 0 ? void 0 : inv.currentStock) || 0);
            const afterQty = beforeQty.plus(qty);
            const prismaStaffId = (params.staffId && !params.staffId.startsWith("STORE_") && params.staffId !== "SYSTEM") ? params.staffId : undefined;
            // 3. Create InventoryLog
            yield db.inventoryLog.create({
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
            yield InventoryService.adjustGlobalInventory(db, {
                productId: params.productId,
                variantId: params.variantId,
                locationId: params.locationId,
                qtyDelta: qty.toNumber(),
                referenceType: 'ADJUSTMENT', // Using ADJUSTMENT or PURCHASE equivalency in strict enum
                referenceId: batch.id,
                staffId: params.staffId
            });
        });
    }
    /**
     * Restores stock (e.g., on order cancellation or refund).
     * If isSpoilage is true, records the loss without increasing sellable inventory.
     */
    static restoreStock(params, tx) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = tx || prisma_1.default;
            for (const item of params.items) {
                const qty = new client_1.Prisma.Decimal(item.quantity);
                const isSpoilage = item.isSpoilage || false;
                // Find the most recent batch for this product/location to associate the log
                const latestBatch = yield db.batch.findFirst({
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
                    yield db.batch.update({
                        where: { id: latestBatch.id },
                        data: {
                            remainingQty: { increment: qty },
                            version: { increment: 1 }
                        }
                    });
                }
                const prismaStaffId = (params.staffId && !params.staffId.startsWith("STORE_") && params.staffId !== "SYSTEM") ? params.staffId : undefined;
                // Create InventoryLog
                yield db.inventoryLog.create({
                    data: {
                        product: { connect: { id: item.productId } },
                        variant: item.variantId ? { connect: { id: item.variantId } } : undefined,
                        batch: latestBatch ? { connect: { id: latestBatch.id } } : undefined,
                        location: { connect: { id: params.locationId } },
                        type: isSpoilage ? InventoryLogType.SPOILAGE : InventoryLogType.RETURN,
                        beforeQty: (latestBatch === null || latestBatch === void 0 ? void 0 : latestBatch.remainingQty) || 0,
                        afterQty: isSpoilage
                            ? ((latestBatch === null || latestBatch === void 0 ? void 0 : latestBatch.remainingQty) || 0)
                            : (latestBatch ? latestBatch.remainingQty.plus(qty) : 0),
                        delta: isSpoilage ? new client_1.Prisma.Decimal(0) : qty,
                        staff: prismaStaffId ? { connect: { id: prismaStaffId } } : undefined
                    }
                });
                // Update Global Inventory Snapshot via locked wrapper
                // If spoilage, qtyDelta is 0 (inventory doesn't return to sellable pool)
                yield InventoryService.adjustGlobalInventory(db, {
                    productId: item.productId,
                    variantId: item.variantId,
                    locationId: params.locationId,
                    qtyDelta: isSpoilage ? 0 : qty.toNumber(),
                    referenceType: isSpoilage ? 'MORTALITY' : 'REFUND',
                    referenceId: params.referenceId,
                    staffId: params.staffId
                });
            }
        });
    }
    /**
     * Real stock reservation – deducts from batches immediately.
     * Use this for Web/WhatsApp orders to prevent overselling while paying.
     */
    static reserveStock(params, tx) {
        return __awaiter(this, void 0, void 0, function* () {
            // We reuse deductStock logic but with a specific reference
            return yield InventoryService.deductStock(Object.assign(Object.assign({}, params), { type: InventoryLogType.SALE // Use SALE for now to match DB schema enum
             }), tx);
        });
    }
}
exports.InventoryService = InventoryService;
