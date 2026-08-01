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
exports.getInwardHistory = exports.getMortalityHistory = exports.recordMortality = exports.addInwardStock = exports.transferStock = exports.createAdjustment = exports.syncInventory = exports.adjustStock = exports.getStoreInventory = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const consolidateStoreInventory = (locationId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = yield prisma_1.default.product.findMany();
        for (const product of products) {
            const allInventory = yield prisma_1.default.inventory.findMany({
                where: { productId: product.id, locationId }
            });
            if (allInventory.length === 0)
                continue;
            // Find or select the primary Base Product Inventory record (variantId = null)
            let baseInv = allInventory.find(i => i.variantId === null);
            let totalStock = 0;
            const duplicateIdsToDelete = [];
            for (const inv of allInventory) {
                totalStock += Number(inv.currentStock || 0);
            }
            if (!baseInv) {
                // If no base inventory record exists, convert the first inventory record or create base record
                baseInv = yield prisma_1.default.inventory.create({
                    data: {
                        productId: product.id,
                        locationId,
                        variantId: null,
                        currentStock: new client_1.Prisma.Decimal(totalStock),
                        thresholdStock: 5
                    }
                });
                // Delete all old variant/non-base records
                for (const inv of allInventory) {
                    duplicateIdsToDelete.push(inv.id);
                }
            }
            else {
                // Primary base inventory exists: update it with total consolidated stock
                yield prisma_1.default.inventory.update({
                    where: { id: baseInv.id },
                    data: {
                        currentStock: new client_1.Prisma.Decimal(totalStock)
                    }
                });
                // Delete all other inventory records (variants / duplicate base rows)
                for (const inv of allInventory) {
                    if (inv.id !== baseInv.id) {
                        duplicateIdsToDelete.push(inv.id);
                    }
                }
            }
            if (duplicateIdsToDelete.length > 0) {
                yield prisma_1.default.inventory.deleteMany({
                    where: { id: { in: duplicateIdsToDelete } }
                });
            }
        }
    }
    catch (err) {
        console.error(`[Consolidate Inventory Error] ${err.message}`);
    }
});
const getStoreInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId } = req.params;
    const authUser = req.user;
    // Enforce high-fidelity regional isolation with defensive role validation
    if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) === "STORE_ADMIN" && authUser.locationId !== locationId) {
        return res.status(403).json({ message: "Access Denied: Regional Data Isolation Protocol Active" });
    }
    try {
        const targetLocId = locationId;
        yield consolidateStoreInventory(targetLocId);
        const inventory = yield prisma_1.default.inventory.findMany({
            where: { locationId: targetLocId },
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getStoreInventory = getStoreInventory;
const adjustStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { currentStock, thresholdStock } = req.body;
    const authUser = req.user;
    try {
        const current = yield prisma_1.default.inventory.findUnique({ where: { id: id } });
        if (!current)
            return res.status(404).json({ message: "Inventory record not found" });
        // Institutional Authorization Check with defensive role validation
        if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) === "STORE_ADMIN" && authUser.locationId !== current.locationId) {
            return res.status(403).json({ message: "Access Denied: Cross-Hub manipulation restricted" });
        }
        const nextStock = currentStock !== undefined ? new client_1.Prisma.Decimal(currentStock) : current.currentStock;
        const nextThreshold = thresholdStock !== undefined ? new client_1.Prisma.Decimal(thresholdStock) : current.thresholdStock;
        const inventory = yield prisma_1.default.inventory.update({
            where: { id: id },
            data: {
                currentStock: nextStock,
                thresholdStock: nextThreshold,
                isLowStock: Number(nextStock) <= Number(nextThreshold)
            }
        });
        res.json(inventory);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.adjustStock = adjustStock;
const syncInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId } = req.body;
    const authUser = req.user;
    if (!locationId)
        return res.status(400).json({ message: "locationId is required" });
    // Enforce isolation for sync protocol with defensive role validation
    if ((authUser === null || authUser === void 0 ? void 0 : authUser.role) === "STORE_ADMIN" && authUser.locationId !== locationId) {
        return res.status(403).json({ message: "Access Denied: Unauthorized Hub Synchronization Request" });
    }
    try {
        const targetLocationId = locationId;
        yield consolidateStoreInventory(targetLocationId);
        const products = yield prisma_1.default.product.findMany();
        let count = 0;
        for (const product of products) {
            const existing = yield prisma_1.default.inventory.findFirst({
                where: {
                    productId: product.id,
                    locationId: targetLocationId,
                    variantId: null
                }
            });
            if (!existing) {
                yield prisma_1.default.inventory.create({
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
        res.json({ message: `Inventory synced for ${count} nodes`, count });
    }
    catch (error) {
        console.error("Sync Logic Failure:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.syncInventory = syncInventory;
const createAdjustment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { productId, variantId, locationId, quantity, type, reason } = req.body;
    try {
        const current = yield prisma_1.default.inventory.findFirst({
            where: {
                productId,
                locationId,
                variantId: variantId || null
            }
        });
        if (!current)
            return res.status(404).json({ message: "Inventory node not found for this product/location combination" });
        const adjustment = new client_1.Prisma.Decimal(quantity || "0");
        const nextStock = (type === "PURCHASE" || (type === "ADJUSTMENT" && adjustment.gt(0)))
            ? (new client_1.Prisma.Decimal(current.currentStock)).plus(adjustment)
            : (new client_1.Prisma.Decimal(current.currentStock)).minus(adjustment.abs());
        const updated = yield prisma_1.default.inventory.update({
            where: { id: current.id },
            data: {
                currentStock: nextStock.gt(0) ? nextStock : 0,
                isLowStock: (nextStock.gt(0) ? nextStock : new client_1.Prisma.Decimal(0)).lte(current.thresholdStock),
                lastRestocked: (type === "PURCHASE" || adjustment.gt(0)) ? new Date() : current.lastRestocked
            }
        });
        // Record Detailed Inventory Log
        yield prisma_1.default.inventoryLog.create({
            data: {
                productId: current.productId,
                variantId: current.variantId,
                locationId: current.locationId,
                type: (type || "ADJUSTMENT"),
                beforeQty: current.currentStock,
                afterQty: client_1.Prisma.Decimal.max(0, nextStock),
                delta: adjustment,
                staffId: ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) === null || _b === void 0 ? void 0 : _b.startsWith("STORE_")) ? null : ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId) || null,
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error("Adjustment Failure:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.createAdjustment = createAdjustment;
const transferStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sourceLocationId, destLocationId, items } = req.body;
    const authUser = req.user;
    if (!sourceLocationId || !destLocationId || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid transfer request parameters" });
    }
    try {
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const transferResults = [];
            for (const item of items) {
                const { productId, variantId, quantity } = item;
                const transferQty = new client_1.Prisma.Decimal(quantity || 0);
                const currentVariantId = variantId || null;
                // 1. Deduct from Source
                const sourceInventory = yield tx.inventory.findFirst({
                    where: {
                        productId,
                        locationId: sourceLocationId,
                        variantId: currentVariantId
                    }
                });
                if (!sourceInventory || (new client_1.Prisma.Decimal(sourceInventory.currentStock)).lt(transferQty)) {
                    throw new Error(`Insufficient stock at sourcehub for product ${productId}. Available: ${(sourceInventory === null || sourceInventory === void 0 ? void 0 : sourceInventory.currentStock) || 0}`);
                }
                const beforeSourceStock = new client_1.Prisma.Decimal(sourceInventory.currentStock);
                const afterSourceStock = beforeSourceStock.minus(transferQty);
                const updatedSource = yield tx.inventory.update({
                    where: { id: sourceInventory.id },
                    data: {
                        currentStock: afterSourceStock,
                        isLowStock: afterSourceStock.lte(new client_1.Prisma.Decimal(sourceInventory.thresholdStock))
                    }
                });
                // 2. Add to Destination
                let destInventory = yield tx.inventory.findFirst({
                    where: {
                        productId,
                        locationId: destLocationId,
                        variantId: currentVariantId
                    }
                });
                let beforeDestStock = new client_1.Prisma.Decimal(0);
                let afterDestStock = transferQty;
                if (!destInventory) {
                    destInventory = yield tx.inventory.create({
                        data: {
                            productId,
                            locationId: destLocationId,
                            variantId: currentVariantId,
                            currentStock: transferQty,
                            thresholdStock: 5
                        }
                    });
                }
                else {
                    beforeDestStock = new client_1.Prisma.Decimal(destInventory.currentStock);
                    afterDestStock = beforeDestStock.plus(transferQty);
                    yield tx.inventory.update({
                        where: { id: destInventory.id },
                        data: {
                            currentStock: afterDestStock,
                            isLowStock: afterDestStock.lte(new client_1.Prisma.Decimal(destInventory.thresholdStock))
                        }
                    });
                }
                // 3. Record Inventory Logs (Atomic)
                yield tx.inventoryLog.create({
                    data: {
                        productId,
                        variantId: currentVariantId,
                        locationId: sourceLocationId,
                        type: "TRANSFER",
                        beforeQty: beforeSourceStock,
                        afterQty: afterSourceStock,
                        delta: transferQty.negated(),
                        staffId: ((_a = authUser === null || authUser === void 0 ? void 0 : authUser.userId) === null || _a === void 0 ? void 0 : _a.startsWith("STORE_")) ? null : (authUser === null || authUser === void 0 ? void 0 : authUser.userId) || null
                    }
                });
                yield tx.inventoryLog.create({
                    data: {
                        productId,
                        variantId: currentVariantId,
                        locationId: destLocationId,
                        type: "TRANSFER",
                        beforeQty: beforeDestStock,
                        afterQty: afterDestStock,
                        delta: transferQty,
                        staffId: ((_b = authUser === null || authUser === void 0 ? void 0 : authUser.userId) === null || _b === void 0 ? void 0 : _b.startsWith("STORE_")) ? null : (authUser === null || authUser === void 0 ? void 0 : authUser.userId) || null
                    }
                });
                transferResults.push({ productId, quantity: transferQty.toNumber() });
            }
            return transferResults;
        }));
        res.json({ message: "Inter-store movement protocol successfully executed", results: result });
    }
    catch (error) {
        console.error("Logistic Protocol Interruption:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.transferStock = transferStock;
const addInwardStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId, items } = req.body;
    const authUser = req.user;
    if (!locationId || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid inward request parameters" });
    }
    try {
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const inwardResults = [];
            for (const item of items) {
                const { productId, variantId, quantity, costPrice } = item;
                // 🛡️ SANITY CHECK: Verify foreign keys BEFORE creation to prevent P2003
                const [locCheck, prodCheck, variantCheck] = yield Promise.all([
                    tx.location.findUnique({ where: { id: locationId }, select: { id: true } }),
                    tx.product.findUnique({ where: { id: productId }, select: { id: true } }),
                    variantId ? tx.productVariant.findUnique({ where: { id: variantId }, select: { id: true } }) : Promise.resolve(true)
                ]);
                if (!locCheck)
                    throw new Error(`Invalid Location ID: ${locationId}`);
                if (!prodCheck)
                    throw new Error(`Invalid Product ID: ${productId}`);
                if (variantId && !variantCheck) {
                    console.warn(`[INWARD] Skipping stale variant ID: ${variantId} for product ${productId}. Reverting to base product.`);
                }
                const inwardQty = new client_1.Prisma.Decimal(quantity);
                const inwardPrice = new client_1.Prisma.Decimal(costPrice || 0);
                // 1. Update/Create Inventory Node
                const currentVariantId = (variantId && variantCheck) ? variantId : null;
                let inventory = yield tx.inventory.findFirst({
                    where: { productId, locationId, variantId: currentVariantId }
                });
                let beforeQty = new client_1.Prisma.Decimal(0);
                if (!inventory) {
                    inventory = yield tx.inventory.create({
                        data: {
                            productId,
                            locationId,
                            variantId: currentVariantId,
                            currentStock: inwardQty,
                            thresholdStock: 5
                        }
                    });
                }
                else {
                    beforeQty = new client_1.Prisma.Decimal(inventory.currentStock);
                    inventory = yield tx.inventory.update({
                        where: { id: inventory.id },
                        data: {
                            currentStock: { increment: inwardQty },
                            isLowStock: beforeQty.plus(inwardQty).lte(inventory.thresholdStock),
                            lastRestocked: new Date()
                        }
                    });
                }
                // 2. Create Batch Record
                let validatedStaffId = null;
                if (authUser === null || authUser === void 0 ? void 0 : authUser.userId) {
                    const staffExists = yield tx.user.findUnique({
                        where: { id: authUser.userId },
                        select: { id: true }
                    });
                    if (staffExists)
                        validatedStaffId = authUser.userId;
                }
                const batch = yield tx.batch.create({
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
                yield tx.inventoryLog.create({
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
        }));
        res.json({ message: "Inward stock entries processed successfully", results: result });
    }
    catch (error) {
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
});
exports.addInwardStock = addInwardStock;
const recordMortality = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId, variantId, locationId, quantity, reason, price } = req.body;
    const authUser = req.user;
    if (!locationId || !productId || !quantity) {
        return res.status(400).json({ message: "Invalid mortality parameters" });
    }
    try {
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const mortQty = new client_1.Prisma.Decimal(quantity);
            let remainingToDeduct = new client_1.Prisma.Decimal(quantity);
            // PHASE 1: Fetch Batches with Variant Fallback
            let batches = yield tx.batch.findMany({
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
                batches = yield tx.batch.findMany({
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
            let totalDeducted = new client_1.Prisma.Decimal(0);
            for (const batch of batches) {
                if (remainingToDeduct.lte(0))
                    break;
                const batchStock = new client_1.Prisma.Decimal(batch.remainingQty);
                const deduct = client_1.Prisma.Decimal.min(batchStock, remainingToDeduct);
                // Deduct from Batch and capture the effective cost being lost
                yield tx.batch.update({
                    where: { id: batch.id },
                    data: { remainingQty: { decrement: deduct } }
                });
                const costPrice = price !== undefined ? new client_1.Prisma.Decimal(price) : new client_1.Prisma.Decimal(batch.costPrice);
                const lossAmount = costPrice.mul(deduct);
                yield tx.mortalityLog.create({
                    data: {
                        productId,
                        variantId: variantId || null,
                        batchId: batch.id,
                        locationId,
                        reason: reason || "SPOILAGE",
                        quantity: deduct,
                        costPrice: costPrice,
                        totalLoss: lossAmount,
                        staffId: ((authUser === null || authUser === void 0 ? void 0 : authUser.userId) && !authUser.userId.startsWith("STORE_")) ? authUser.userId : null
                    }
                });
                remainingToDeduct = remainingToDeduct.minus(deduct);
                totalDeducted = totalDeducted.plus(deduct);
            }
            if (totalDeducted.lte(0)) {
                throw new Error("Could not reconcile any wastage against existing batches. Stock levels might already be zero.");
            }
            // Update Global Stock Node with Variant Fallback
            let inventory = yield tx.inventory.findFirst({
                where: { productId, variantId: variantId || null, locationId }
            });
            // FALLBACK: If no inventory on variant, update base product inventory
            if ((!inventory || inventory.currentStock.lessThanOrEqualTo(0)) && variantId) {
                inventory = yield tx.inventory.findFirst({
                    where: { productId, variantId: null, locationId }
                });
            }
            if (inventory) {
                const before = new client_1.Prisma.Decimal(inventory.currentStock);
                const after = before.minus(totalDeducted).gt(0) ? before.minus(totalDeducted) : new client_1.Prisma.Decimal(0);
                yield tx.inventory.update({
                    where: { id: inventory.id },
                    data: {
                        currentStock: after,
                        isLowStock: after.lte(new client_1.Prisma.Decimal(inventory.thresholdStock))
                    }
                });
                // Detailed Audit Log
                yield tx.inventoryLog.create({
                    data: {
                        productId,
                        variantId: variantId || null,
                        locationId,
                        type: "SPOILAGE",
                        beforeQty: before,
                        afterQty: after,
                        delta: totalDeducted.negated(),
                        staffId: ((authUser === null || authUser === void 0 ? void 0 : authUser.userId) && !authUser.userId.startsWith("STORE_")) ? authUser.userId : null
                    }
                });
            }
            return { success: true, reconciled: mortQty.minus(remainingToDeduct) };
        }));
        res.json(result);
    }
    catch (error) {
        console.error("[MORTALITY] Error:", error.message);
        res.status(400).json({
            message: error.message || "Failed to process mortality reconciliation",
            code: "MORTALITY_RECON_FAILED"
        });
    }
});
exports.recordMortality = recordMortality;
const getMortalityHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId } = req.params;
    try {
        const logs = yield prisma_1.default.mortalityLog.findMany({
            where: { locationId: locationId },
            include: {
                product: { select: { name: true } },
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getMortalityHistory = getMortalityHistory;
const getInwardHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { locationId } = req.params;
    try {
        const batches = yield prisma_1.default.batch.findMany({
            where: { locationId: locationId },
            include: {
                product: { select: { name: true, sku: true } },
                variant: { select: { name: true } },
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 100
        });
        res.json(batches);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getInwardHistory = getInwardHistory;
