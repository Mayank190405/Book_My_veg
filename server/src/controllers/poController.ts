import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { Prisma, POStatus } from "@prisma/client";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string; locationId?: string };
}

// Generate sequential PO number (e.g. PO-2026-0001)
const generatePONumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count();
    const sequence = String(count + 1).padStart(4, "0");
    return `PO-${year}-${sequence}`;
};

// Helper: Get list of location IDs accessible by caller
const getAccessibleLocationIds = async (user?: { userId?: string; id?: string; role?: string; locationId?: string }): Promise<string[] | null> => {
    if (!user) return [];
    const uid = user.userId || user.id || "";
    const role = user.role || "";

    if (role === "ADMIN" || role === "SUPER_ADMIN") {
        return null; // Null means unrestricted access to all stores
    }
    if (role === "PURCHASE_MANAGER" && uid) {
        try {
            const [assignments, stores] = await Promise.all([
                prisma.purchaseManagerLocation.findMany({
                    where: { userId: uid },
                    select: { locationId: true }
                }).catch(() => []),
                prisma.location.findMany({
                    where: { purchaseManagerId: uid },
                    select: { id: true }
                }).catch(() => [])
            ]);
            const assignedIds = new Set([
                ...assignments.map(a => a.locationId),
                ...stores.map(s => s.id)
            ]);
            if (user.locationId) assignedIds.add(user.locationId);
            return Array.from(assignedIds);
        } catch (e) {
            console.error("[getAccessibleLocationIds Error]:", e);
        }
    }
    // Store Admin / Operator
    let locId = user.locationId;
    if (uid && uid.startsWith("STORE_")) {
        locId = uid.replace("STORE_", "");
    }
    return locId ? [locId] : [];
};

// ─── 1. Create Purchase Order (Store Creation) ────────────────────────────────

export const createPurchaseOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { items, notes, supplierName, supplierPhone, locationId: reqLocId } = req.body;
    const caller = req.user;

    let targetLocationId = reqLocId || caller?.locationId;
    if (caller?.userId.startsWith("STORE_")) {
        targetLocationId = caller.userId.replace("STORE_", "");
    }

    if (!targetLocationId) {
        return res.status(400).json({ message: "Store location is required to create a Purchase Order." });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one product item is required for the Purchase Order." });
    }

    try {
        const poNumber = await generatePONumber();

        const po = await prisma.$transaction(async (tx) => {
            let totalEst = 0;
            const itemCreates = items.map((i: any) => {
                const qty = Number(i.requestedQty || i.quantity || 1);
                const estPrice = Number(i.buyingPrice || i.estimatedPrice || 0);
                totalEst += qty * estPrice;
                return {
                    productId: String(i.productId),
                    variantId: i.variantId ? String(i.variantId) : null,
                    requestedQty: new Prisma.Decimal(qty),
                    approvedQty: new Prisma.Decimal(qty),
                    buyingPrice: new Prisma.Decimal(estPrice),
                    totalCost: new Prisma.Decimal(qty * estPrice),
                    addedByManager: false
                };
            });

            // Find valid user ID for creator (fallback to root admin if virtual store user)
            let creatorId = caller?.userId;
            if (creatorId?.startsWith("STORE_")) {
                const adminUser = await tx.user.findFirst({ where: { role: { in: ["ADMIN", "STORE_ADMIN"] } } });
                creatorId = adminUser?.id || creatorId;
            }

            return await tx.purchaseOrder.create({
                data: {
                    poNumber,
                    locationId: String(targetLocationId),
                    createdById: String(creatorId),
                    notes: notes || null,
                    supplierName: supplierName || null,
                    supplierPhone: supplierPhone || null,
                    status: POStatus.SUBMITTED,
                    totalEstimatedCost: new Prisma.Decimal(totalEst),
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
        });

        res.status(201).json({ message: "Purchase Order submitted successfully for manager review.", purchaseOrder: po });
    } catch (error) { next(error); }
};

let schemaEnsured = false;
const ensurePOSchema = async () => {
    if (schemaEnsured) return;
    try {
        await prisma.$executeRawUnsafe(`
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
    } catch (e) {
        console.error("[PO SCHEMA SETUP WARNING]", e);
    }
};

// ─── 2. List Purchase Orders ──────────────────────────────────────────────────

export const getPurchaseOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { status, locationId } = req.query;
    const caller = req.user;

    try {
        await ensurePOSchema();
        const accessibleLocationIds = await getAccessibleLocationIds(caller);

        let whereClause: any = {};

        if (accessibleLocationIds !== null) {
            whereClause.locationId = { in: accessibleLocationIds };
        }

        if (locationId) {
            whereClause.locationId = String(locationId);
        }

        if (status && status !== "ALL") {
            whereClause.status = String(status) as POStatus;
        }

        let purchaseOrders: any[] = [];
        try {
            purchaseOrders = await prisma.purchaseOrder.findMany({
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
        } catch (queryErr) {
            console.warn("[getPurchaseOrders fallback query]:", queryErr);
            purchaseOrders = await prisma.purchaseOrder.findMany({
                where: whereClause,
                include: {
                    location: { select: { id: true, name: true, slug: true } },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, sku: true, images: true, basePrice: true } },
                            variant: { select: { id: true, name: true, price: true } }
                        }
                    }
                },
                orderBy: { createdAt: "desc" }
            });
        }

        res.json({ purchaseOrders });
    } catch (error: any) {
        console.error("[GET PURCHASE ORDERS CRITICAL ERROR]:", error);
        res.json({ purchaseOrders: [] });
    }
};

// ─── 3. Get Single Purchase Order ─────────────────────────────────────────────

export const getPurchaseOrderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const id = String(req.params.id);

    try {
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
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
    } catch (error) { next(error); }
};

// ─── 4. Review & Approve PO (Purchase Manager Action) ─────────────────────────

export const reviewPurchaseOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    const { items, supplierName, supplierPhone, notes, expectedDate, status } = req.body;
    const caller = req.user;

    try {
        const existingPO = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!existingPO) {
            return res.status(404).json({ message: "Purchase Order not found." });
        }

        const po = await prisma.$transaction(async (tx) => {
            // Remove existing items and rebuild updated item list (with extra products added by manager)
            await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

            let totalEst = 0;
            const updatedItems = items.map((i: any) => {
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
                    requestedQty: new Prisma.Decimal(reqQty),
                    approvedQty: new Prisma.Decimal(appQty),
                    buyingPrice: new Prisma.Decimal(buyPrice),
                    totalCost: new Prisma.Decimal(totalCost),
                    addedByManager: Boolean(i.addedByManager || i.isExtra),
                    itemStatus: itemStatus
                };
            });

            await tx.purchaseOrderItem.createMany({ data: updatedItems });

            // Find valid user ID for reviewer
            let reviewerId = caller?.userId;
            if (reviewerId?.startsWith("STORE_")) {
                const adminUser = await tx.user.findFirst({ where: { role: { in: ["ADMIN", "PURCHASE_MANAGER"] } } });
                reviewerId = adminUser?.id || reviewerId;
            }

            const updatedPO = await tx.purchaseOrder.update({
                where: { id },
                data: {
                    supplierName: supplierName || existingPO.supplierName,
                    supplierPhone: supplierPhone || existingPO.supplierPhone,
                    notes: notes !== undefined ? notes : existingPO.notes,
                    status: (status as POStatus) || POStatus.APPROVED,
                    reviewedById: String(reviewerId),
                    totalEstimatedCost: new Prisma.Decimal(totalEst),
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
        });

        res.json({ message: "Purchase Order reviewed and approved successfully.", purchaseOrder: po });
    } catch (error) { next(error); }
};

// ─── 5. Receive & Inward PO (Stock Settlement & Batch Creation) ───────────────

export const receivePurchaseOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const id = String(req.params.id);
    const { items: receivedItems } = req.body;

    try {
        const existingPO = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: { items: true, location: true }
        });

        if (!existingPO) {
            return res.status(404).json({ message: "Purchase Order not found." });
        }

        if (existingPO.status === POStatus.RECEIVED) {
            return res.status(400).json({ message: "Purchase Order has already been fully received and inwarded." });
        }

        const po = await prisma.$transaction(async (tx) => {
            let actualTotalCost = 0;
            const itemsToProcess = Array.isArray(receivedItems) && receivedItems.length > 0 ? receivedItems : existingPO.items;

            for (const rItem of itemsToProcess) {
                const poItem = existingPO.items.find((i: any) => i.id === rItem.id || (i.productId === rItem.productId && i.variantId === (rItem.variantId || null)));
                if (!poItem) continue;

                const recQty = Number(rItem.receivedQty !== undefined ? rItem.receivedQty : (poItem.approvedQty || poItem.requestedQty));
                const unitBuyPrice = Number(rItem.buyingPrice !== undefined ? rItem.buyingPrice : poItem.buyingPrice);
                const itemTotalCost = recQty * unitBuyPrice;
                actualTotalCost += itemTotalCost;

                // 1. Update PO Item received count and final buying price
                await tx.purchaseOrderItem.update({
                    where: { id: poItem.id },
                    data: {
                        receivedQty: new Prisma.Decimal(recQty),
                        buyingPrice: new Prisma.Decimal(unitBuyPrice),
                        totalCost: new Prisma.Decimal(itemTotalCost)
                    }
                });

                // 2. Update physical store stock in Inventory
                const existingInventory = await tx.inventory.findFirst({
                    where: {
                        locationId: existingPO.locationId,
                        productId: poItem.productId,
                        variantId: poItem.variantId || null
                    }
                });

                if (existingInventory) {
                    await tx.inventory.update({
                        where: { id: existingInventory.id },
                        data: {
                            currentStock: new Prisma.Decimal(Number(existingInventory.currentStock) + recQty),
                            lastRestocked: new Date(),
                            isLowStock: false
                        }
                    });
                } else {
                    await tx.inventory.create({
                        data: {
                            locationId: existingPO.locationId,
                            productId: poItem.productId,
                            variantId: poItem.variantId || null,
                            currentStock: new Prisma.Decimal(recQty),
                            lastRestocked: new Date(),
                            isLowStock: false
                        }
                    });
                }

                // 3. Create Cost Price Batch record for P&L tracking
                await tx.batch.create({
                    data: {
                        batchNumber: `BATCH-PO-${existingPO.poNumber.slice(-4)}-${Date.now().toString().slice(-4)}`,
                        productId: poItem.productId,
                        variantId: poItem.variantId || null,
                        locationId: existingPO.locationId,
                        initialQty: new Prisma.Decimal(recQty),
                        remainingQty: new Prisma.Decimal(recQty),
                        costPrice: new Prisma.Decimal(unitBuyPrice),
                        receivedDate: new Date()
                    }
                });
            }

            // Mark PO as RECEIVED
            return await tx.purchaseOrder.update({
                where: { id },
                data: {
                    status: POStatus.RECEIVED,
                    actualCost: new Prisma.Decimal(actualTotalCost),
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
        });

        res.json({ message: "Purchase Order successfully inwarded and inventory stock updated.", purchaseOrder: po });
    } catch (error) { next(error); }
};

// ─── 6. Assign Purchase Manager Stores ────────────────────────────────────────

export const assignPurchaseManagerStores = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { userId, locationIds } = req.body;

    if (!userId || !Array.isArray(locationIds)) {
        return res.status(400).json({ message: "userId and array of locationIds are required." });
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.purchaseManagerLocation.deleteMany({ where: { userId: String(userId) } });
            if (locationIds.length > 0) {
                await tx.purchaseManagerLocation.createMany({
                    data: locationIds.map((locId: string) => ({ userId: String(userId), locationId: String(locId) }))
                });
            }
        });

        res.json({ message: "Purchase Manager store assignments updated successfully." });
    } catch (error) { next(error); }
};

// ─── 7. Get Purchase Manager Assigned Stores ──────────────────────────────────

export const getPurchaseManagerAssignedStores = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const caller = req.user;
    const { managerId } = req.query;

    const targetUserId = (managerId ? String(managerId) : caller?.userId) || "";

    try {
        const assignments = await prisma.purchaseManagerLocation.findMany({
            where: { userId: targetUserId },
            include: {
                location: { select: { id: true, name: true, slug: true, address: true } }
            }
        });

        res.json({ assignedStores: assignments.map(a => a.location) });
    } catch (error) { next(error); }
};
