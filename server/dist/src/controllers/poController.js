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
exports.getPurchaseManagerAssignedStores = exports.assignPurchaseManagerStores = exports.receivePurchaseOrder = exports.reviewPurchaseOrder = exports.getPurchaseOrderById = exports.getPurchaseOrders = exports.createPurchaseOrder = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
// Generate sequential PO number (e.g. PO-2026-0001)
const generatePONumber = () => __awaiter(void 0, void 0, void 0, function* () {
    const year = new Date().getFullYear();
    const count = yield prisma_1.default.purchaseOrder.count();
    const sequence = String(count + 1).padStart(4, "0");
    return `PO-${year}-${sequence}`;
});
// Helper: Get list of location IDs accessible by caller
const getAccessibleLocationIds = (user) => __awaiter(void 0, void 0, void 0, function* () {
    if (!user)
        return [];
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
        return null; // Null means unrestricted access to all stores
    }
    if (user.role === "PURCHASE_MANAGER") {
        const [assignments, stores] = yield Promise.all([
            prisma_1.default.purchaseManagerLocation.findMany({
                where: { userId: user.userId },
                select: { locationId: true }
            }),
            prisma_1.default.location.findMany({
                where: { purchaseManagerId: user.userId },
                select: { id: true }
            })
        ]);
        const assignedIds = new Set([
            ...assignments.map(a => a.locationId),
            ...stores.map(s => s.id)
        ]);
        if (user.locationId)
            assignedIds.add(user.locationId);
        return Array.from(assignedIds);
    }
    // Store Admin / Operator
    let locId = user.locationId;
    if (user.userId.startsWith("STORE_")) {
        locId = user.userId.replace("STORE_", "");
    }
    return locId ? [locId] : [];
});
// ─── 1. Create Purchase Order (Store Creation) ────────────────────────────────
const createPurchaseOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { items, notes, supplierName, supplierPhone, locationId: reqLocId } = req.body;
    const caller = req.user;
    let targetLocationId = reqLocId || (caller === null || caller === void 0 ? void 0 : caller.locationId);
    if (caller === null || caller === void 0 ? void 0 : caller.userId.startsWith("STORE_")) {
        targetLocationId = caller.userId.replace("STORE_", "");
    }
    if (!targetLocationId) {
        return res.status(400).json({ message: "Store location is required to create a Purchase Order." });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one product item is required for the Purchase Order." });
    }
    try {
        const poNumber = yield generatePONumber();
        const po = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            let totalEst = 0;
            const itemCreates = items.map((i) => {
                const qty = Number(i.requestedQty || i.quantity || 1);
                const estPrice = Number(i.buyingPrice || i.estimatedPrice || 0);
                totalEst += qty * estPrice;
                return {
                    productId: String(i.productId),
                    variantId: i.variantId ? String(i.variantId) : null,
                    requestedQty: new client_1.Prisma.Decimal(qty),
                    approvedQty: new client_1.Prisma.Decimal(qty),
                    buyingPrice: new client_1.Prisma.Decimal(estPrice),
                    totalCost: new client_1.Prisma.Decimal(qty * estPrice),
                    addedByManager: false
                };
            });
            // Find valid user ID for creator (fallback to root admin if virtual store user)
            let creatorId = caller === null || caller === void 0 ? void 0 : caller.userId;
            if (creatorId === null || creatorId === void 0 ? void 0 : creatorId.startsWith("STORE_")) {
                const adminUser = yield tx.user.findFirst({ where: { role: { in: ["ADMIN", "STORE_ADMIN"] } } });
                creatorId = (adminUser === null || adminUser === void 0 ? void 0 : adminUser.id) || creatorId;
            }
            return yield tx.purchaseOrder.create({
                data: {
                    poNumber,
                    locationId: String(targetLocationId),
                    createdById: String(creatorId),
                    notes: notes || null,
                    supplierName: supplierName || null,
                    supplierPhone: supplierPhone || null,
                    status: client_1.POStatus.SUBMITTED,
                    totalEstimatedCost: new client_1.Prisma.Decimal(totalEst),
                    items: { create: itemCreates }
                },
                include: {
                    location: { select: { id: true, name: true, slug: true } },
                    createdBy: { select: { id: true, name: true, role: true } },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, sku: true, images: true, basePrice: true } },
                            variant: { select: { id: true, name: true, price: true } }
                        }
                    }
                }
            });
        }));
        res.status(201).json({ message: "Purchase Order submitted successfully for manager review.", purchaseOrder: po });
    }
    catch (error) {
        next(error);
    }
});
exports.createPurchaseOrder = createPurchaseOrder;
let schemaEnsured = false;
const ensurePOSchema = () => __awaiter(void 0, void 0, void 0, function* () {
    if (schemaEnsured)
        return;
    try {
        yield prisma_1.default.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
                "id" TEXT NOT NULL,
                "poNumber" TEXT NOT NULL,
                "locationId" TEXT NOT NULL,
                "createdById" TEXT NOT NULL,
                "reviewedById" TEXT,
                "supplierName" TEXT,
                "supplierPhone" TEXT,
                "notes" TEXT,
                "status" "POStatus" NOT NULL DEFAULT 'SUBMITTED',
                "totalEstimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "actualCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "expectedDate" TIMESTAMP(3),
                "receivedAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
            CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
                "id" TEXT NOT NULL,
                "purchaseOrderId" TEXT NOT NULL,
                "productId" TEXT NOT NULL,
                "variantId" TEXT,
                "requestedQty" DECIMAL(12,3) NOT NULL,
                "approvedQty" DECIMAL(12,3),
                "receivedQty" DECIMAL(12,3),
                "buyingPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
                "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "addedByManager" BOOLEAN NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
            );
            CREATE TABLE IF NOT EXISTS "PurchaseManagerLocation" (
                "id" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                "locationId" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PurchaseManagerLocation_pkey" PRIMARY KEY ("id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseManagerLocation_userId_locationId_key" ON "PurchaseManagerLocation"("userId", "locationId");
        `);
        schemaEnsured = true;
    }
    catch (e) {
        console.error("[PO SCHEMA SETUP WARNING]", e);
    }
});
// ─── 2. List Purchase Orders ──────────────────────────────────────────────────
const getPurchaseOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { status, locationId } = req.query;
    const caller = req.user;
    try {
        yield ensurePOSchema();
        const accessibleLocationIds = yield getAccessibleLocationIds(caller);
        let whereClause = {};
        if (accessibleLocationIds !== null) {
            whereClause.locationId = { in: accessibleLocationIds };
        }
        if (locationId) {
            whereClause.locationId = String(locationId);
        }
        if (status && status !== "ALL") {
            whereClause.status = String(status);
        }
        const purchaseOrders = yield prisma_1.default.purchaseOrder.findMany({
            where: whereClause,
            include: {
                location: { select: { id: true, name: true, slug: true } },
                createdBy: { select: { id: true, name: true, role: true, phone: true } },
                reviewedBy: { select: { id: true, name: true, role: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, sku: true, images: true, basePrice: true } },
                        variant: { select: { id: true, name: true, price: true } }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        res.json({ purchaseOrders });
    }
    catch (error) {
        console.error("[GET PURCHASE ORDERS ERROR]:", error);
        res.json({ purchaseOrders: [] });
    }
});
exports.getPurchaseOrders = getPurchaseOrders;
// ─── 3. Get Single Purchase Order ─────────────────────────────────────────────
const getPurchaseOrderById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const id = String(req.params.id);
    try {
        const purchaseOrder = yield prisma_1.default.purchaseOrder.findUnique({
            where: { id },
            include: {
                location: { select: { id: true, name: true, slug: true, address: true, contactNumber: true } },
                createdBy: { select: { id: true, name: true, role: true, phone: true, email: true } },
                reviewedBy: { select: { id: true, name: true, role: true, phone: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, sku: true, images: true, basePrice: true, weightUnit: true } },
                        variant: { select: { id: true, name: true, price: true } }
                    }
                }
            }
        });
        if (!purchaseOrder) {
            return res.status(404).json({ message: "Purchase Order not found." });
        }
        res.json({ purchaseOrder });
    }
    catch (error) {
        next(error);
    }
});
exports.getPurchaseOrderById = getPurchaseOrderById;
// ─── 4. Review & Approve PO (Purchase Manager Action) ─────────────────────────
const reviewPurchaseOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const id = String(req.params.id);
    const { items, supplierName, supplierPhone, notes, expectedDate, status } = req.body;
    const caller = req.user;
    try {
        const existingPO = yield prisma_1.default.purchaseOrder.findUnique({
            where: { id },
            include: { items: true }
        });
        if (!existingPO) {
            return res.status(404).json({ message: "Purchase Order not found." });
        }
        const po = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Remove existing items and rebuild updated item list (with extra products added by manager)
            yield tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
            let totalEst = 0;
            const updatedItems = items.map((i) => {
                const itemStatus = String(i.itemStatus || "APPROVED").toUpperCase();
                const isRejected = itemStatus === "REJECTED";
                const reqQty = Number(i.requestedQty || i.quantity || 1);
                const appQty = isRejected ? 0 : Number(i.approvedQty !== undefined ? i.approvedQty : reqQty);
                const buyPrice = Number(i.buyingPrice || 0);
                const totalCost = isRejected ? 0 : appQty * buyPrice;
                if (!isRejected) {
                    totalEst += totalCost;
                }
                return {
                    purchaseOrderId: id,
                    productId: String(i.productId),
                    variantId: i.variantId ? String(i.variantId) : null,
                    requestedQty: new client_1.Prisma.Decimal(reqQty),
                    approvedQty: new client_1.Prisma.Decimal(appQty),
                    buyingPrice: new client_1.Prisma.Decimal(buyPrice),
                    totalCost: new client_1.Prisma.Decimal(totalCost),
                    addedByManager: Boolean(i.addedByManager || i.isExtra),
                    itemStatus: itemStatus
                };
            });
            yield tx.purchaseOrderItem.createMany({ data: updatedItems });
            // Find valid user ID for reviewer
            let reviewerId = caller === null || caller === void 0 ? void 0 : caller.userId;
            if (reviewerId === null || reviewerId === void 0 ? void 0 : reviewerId.startsWith("STORE_")) {
                const adminUser = yield tx.user.findFirst({ where: { role: { in: ["ADMIN", "PURCHASE_MANAGER"] } } });
                reviewerId = (adminUser === null || adminUser === void 0 ? void 0 : adminUser.id) || reviewerId;
            }
            const updatedPO = yield tx.purchaseOrder.update({
                where: { id },
                data: {
                    supplierName: supplierName || existingPO.supplierName,
                    supplierPhone: supplierPhone || existingPO.supplierPhone,
                    notes: notes !== undefined ? notes : existingPO.notes,
                    status: status || client_1.POStatus.APPROVED,
                    reviewedById: String(reviewerId),
                    totalEstimatedCost: new client_1.Prisma.Decimal(totalEst),
                    expectedDate: expectedDate ? new Date(expectedDate) : existingPO.expectedDate
                },
                include: {
                    location: { select: { id: true, name: true, slug: true } },
                    createdBy: { select: { id: true, name: true, role: true } },
                    reviewedBy: { select: { id: true, name: true, role: true } },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, sku: true, images: true, basePrice: true } },
                            variant: { select: { id: true, name: true, price: true } }
                        }
                    }
                }
            });
            return updatedPO;
        }));
        res.json({ message: "Purchase Order reviewed and approved successfully.", purchaseOrder: po });
    }
    catch (error) {
        next(error);
    }
});
exports.reviewPurchaseOrder = reviewPurchaseOrder;
// ─── 5. Receive & Inward PO (Stock Settlement & Batch Creation) ───────────────
const receivePurchaseOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const id = String(req.params.id);
    const { items: receivedItems } = req.body;
    try {
        const existingPO = yield prisma_1.default.purchaseOrder.findUnique({
            where: { id },
            include: { items: true, location: true }
        });
        if (!existingPO) {
            return res.status(404).json({ message: "Purchase Order not found." });
        }
        if (existingPO.status === client_1.POStatus.RECEIVED) {
            return res.status(400).json({ message: "Purchase Order has already been fully received and inwarded." });
        }
        const po = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            let actualTotalCost = 0;
            const itemsToProcess = Array.isArray(receivedItems) && receivedItems.length > 0 ? receivedItems : existingPO.items;
            for (const rItem of itemsToProcess) {
                const poItem = existingPO.items.find((i) => i.id === rItem.id || (i.productId === rItem.productId && i.variantId === (rItem.variantId || null)));
                if (!poItem)
                    continue;
                const recQty = Number(rItem.receivedQty !== undefined ? rItem.receivedQty : (poItem.approvedQty || poItem.requestedQty));
                const unitBuyPrice = Number(rItem.buyingPrice !== undefined ? rItem.buyingPrice : poItem.buyingPrice);
                const itemTotalCost = recQty * unitBuyPrice;
                actualTotalCost += itemTotalCost;
                // 1. Update PO Item received count and final buying price
                yield tx.purchaseOrderItem.update({
                    where: { id: poItem.id },
                    data: {
                        receivedQty: new client_1.Prisma.Decimal(recQty),
                        buyingPrice: new client_1.Prisma.Decimal(unitBuyPrice),
                        totalCost: new client_1.Prisma.Decimal(itemTotalCost)
                    }
                });
                // 2. Update physical store stock in Inventory
                const existingInventory = yield tx.inventory.findFirst({
                    where: {
                        locationId: existingPO.locationId,
                        productId: poItem.productId,
                        variantId: poItem.variantId || null
                    }
                });
                if (existingInventory) {
                    yield tx.inventory.update({
                        where: { id: existingInventory.id },
                        data: {
                            currentStock: new client_1.Prisma.Decimal(Number(existingInventory.currentStock) + recQty),
                            lastRestocked: new Date(),
                            isLowStock: false
                        }
                    });
                }
                else {
                    yield tx.inventory.create({
                        data: {
                            locationId: existingPO.locationId,
                            productId: poItem.productId,
                            variantId: poItem.variantId || null,
                            currentStock: new client_1.Prisma.Decimal(recQty),
                            lastRestocked: new Date(),
                            isLowStock: false
                        }
                    });
                }
                // 3. Create Cost Price Batch record for P&L tracking
                yield tx.batch.create({
                    data: {
                        batchNumber: `BATCH-PO-${existingPO.poNumber.slice(-4)}-${Date.now().toString().slice(-4)}`,
                        productId: poItem.productId,
                        variantId: poItem.variantId || null,
                        locationId: existingPO.locationId,
                        initialQty: new client_1.Prisma.Decimal(recQty),
                        remainingQty: new client_1.Prisma.Decimal(recQty),
                        costPrice: new client_1.Prisma.Decimal(unitBuyPrice),
                        receivedDate: new Date()
                    }
                });
            }
            // Mark PO as RECEIVED
            return yield tx.purchaseOrder.update({
                where: { id },
                data: {
                    status: client_1.POStatus.RECEIVED,
                    actualCost: new client_1.Prisma.Decimal(actualTotalCost),
                    receivedAt: new Date()
                },
                include: {
                    location: { select: { id: true, name: true } },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, sku: true } },
                            variant: { select: { id: true, name: true } }
                        }
                    }
                }
            });
        }));
        res.json({ message: "Purchase Order successfully inwarded and inventory stock updated.", purchaseOrder: po });
    }
    catch (error) {
        next(error);
    }
});
exports.receivePurchaseOrder = receivePurchaseOrder;
// ─── 6. Assign Purchase Manager Stores ────────────────────────────────────────
const assignPurchaseManagerStores = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, locationIds } = req.body;
    if (!userId || !Array.isArray(locationIds)) {
        return res.status(400).json({ message: "userId and array of locationIds are required." });
    }
    try {
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.purchaseManagerLocation.deleteMany({ where: { userId: String(userId) } });
            if (locationIds.length > 0) {
                yield tx.purchaseManagerLocation.createMany({
                    data: locationIds.map((locId) => ({ userId: String(userId), locationId: String(locId) }))
                });
            }
        }));
        res.json({ message: "Purchase Manager store assignments updated successfully." });
    }
    catch (error) {
        next(error);
    }
});
exports.assignPurchaseManagerStores = assignPurchaseManagerStores;
// ─── 7. Get Purchase Manager Assigned Stores ──────────────────────────────────
const getPurchaseManagerAssignedStores = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const caller = req.user;
    const { managerId } = req.query;
    const targetUserId = (managerId ? String(managerId) : caller === null || caller === void 0 ? void 0 : caller.userId) || "";
    try {
        const assignments = yield prisma_1.default.purchaseManagerLocation.findMany({
            where: { userId: targetUserId },
            include: {
                location: { select: { id: true, name: true, slug: true, address: true } }
            }
        });
        res.json({ assignedStores: assignments.map(a => a.location) });
    }
    catch (error) {
        next(error);
    }
});
exports.getPurchaseManagerAssignedStores = getPurchaseManagerAssignedStores;
