
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { AccountingService } from "./accountingService";
import { InventoryService } from "./inventoryService";

export class MandiRateService {
    /**
     * Bulk-save Mandi rates for the day (called at ~7AM).
     * Uses upsert so it's safe to run multiple times.
     */
    static async saveBulkRates(rates: {
        productId: string;
        channel: "WEB" | "POS" | "WHATSAPP";
        costPrice: number;
        staffId?: string;
    }[]) {
        const results = [];
        for (const rate of rates) {
            const result = await prisma.mandiRate.upsert({
                where: { productId_channel: { productId: rate.productId, channel: rate.channel } },
                update: {
                    costPrice: new Prisma.Decimal(rate.costPrice),
                    staffId: rate.staffId,
                    date: new Date()
                },
                create: {
                    productId: rate.productId,
                    channel: rate.channel as any,
                    costPrice: new Prisma.Decimal(rate.costPrice),
                    staffId: rate.staffId
                }
            });
            results.push(result);

            // Also update the Pricing table for the given channel
            await prisma.pricing.updateMany({
                where: { productId: rate.productId, channel: rate.channel as any, isActive: true },
                data: { price: new Prisma.Decimal(rate.costPrice) }
            });
        }
        return results;
    }

    /**
     * Get rates for a specific date (defaults to today).
     */
    static async getRates(params?: { date?: Date; productId?: string; channel?: string }) {
        const start = params?.date ? new Date(params.date) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);

        return prisma.mandiRate.findMany({
            where: {
                date: { gte: start, lte: end },
                ...(params?.productId && { productId: params.productId }),
                ...(params?.channel && { channel: params.channel as any })
            },
            include: {
                product: { select: { id: true, name: true, basePrice: true } },
                staff: { select: { id: true, name: true } }
            },
            orderBy: { date: "desc" }
        });
    }
}

export class MortalityService {
    /**
     * Records a mortality/damage event.
     * Deducts from inventory and posts a DAMAGE journal entry.
     */
    static async logMortality(params: {
        productId: string;
        variantId?: string;
        locationId: string;
        batchId?: string;
        quantity: number;
        reason: "ROTTEN" | "DAMAGED" | "EXPIRED" | "SHRINKAGE" | "OTHER";
        notes?: string;
        staffId?: string;
        traceId: string;
    }) {
        const qty = new Prisma.Decimal(params.quantity);

        // 1. Deduct the batch if specified
        if (params.batchId) {
            await prisma.batch.update({
                where: { id: params.batchId },
                data: { remainingQty: { decrement: qty } }
            });
        }

        // 2. Decrement global inventory snapshot
        await prisma.inventory.updateMany({
            where: {
                productId: params.productId,
                locationId: params.locationId,
                variantId: params.variantId || null
            },
            data: { currentStock: { decrement: qty.toNumber() } }
        });

        // 3. Post accounting entry: DR Natural Loss (Expense) / CR Inventory
        const latestBatch = params.batchId
            ? await prisma.batch.findUnique({ where: { id: params.batchId } })
            : await prisma.batch.findFirst({
                where: { productId: params.productId, locationId: params.locationId, remainingQty: { gt: 0 } },
                orderBy: { receivedDate: "asc" }
            });
        const costPrice = new Prisma.Decimal(latestBatch?.costPrice || 0);
        const totalLoss = costPrice.mul(qty);

        let journal = null;
        if (totalLoss.greaterThan(0)) {
            journal = await AccountingService.createJournalEntry({
                transactionId: params.traceId,
                locationId: params.locationId,
                staffId: params.staffId,
                reference: `MORTALITY_${params.productId}`,
                description: `Natural Loss: ${params.reason} — Qty: ${params.quantity}`,
                entries: [
                    { accountId: "COA_NATURAL_LOSS", debit: totalLoss, credit: 0 },
                    { accountId: "COA_INVENTORY", debit: 0, credit: totalLoss }
                ]
            });
        }

        // 4. Create mortality log
        return prisma.mortalityLog.create({
            data: {
                productId: params.productId,
                variantId: params.variantId,
                locationId: params.locationId,
                batchId: params.batchId,
                quantity: qty,
                reason: params.reason as any,
                notes: params.notes,
                staffId: params.staffId,
                journalId: journal?.id
            },
            include: {
                product: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } }
            }
        });
    }

    static async getHistory(params: { locationId?: string; from?: Date; to?: Date }) {
        return prisma.mortalityLog.findMany({
            where: {
                ...(params.locationId && { locationId: params.locationId }),
                createdAt: {
                    ...(params.from && { gte: params.from }),
                    ...(params.to && { lte: params.to })
                }
            },
            include: {
                product: { select: { id: true, name: true } },
                variant: { select: { name: true } },
                batch: { select: { batchNumber: true, costPrice: true } },
                staff: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: "desc" }
        });
    }
}

export class StockTransferService {
    /**
     * Initiates a transfer from one location to another.
     */
    static async initiateTransfer(params: {
        productId: string;
        variantId?: string;
        fromLocationId: string;
        toLocationId: string;
        quantity: number;
        initiatedById?: string;
        notes?: string;
    }) {
        const qty = new Prisma.Decimal(params.quantity);

        // Validate source has enough stock
        const sourceInventory = await prisma.inventory.findFirst({
            where: {
                productId: params.productId,
                locationId: params.fromLocationId,
                variantId: params.variantId || null
            }
        });

        if (!sourceInventory || sourceInventory.currentStock < qty.toNumber()) {
            throw new Error(`Insufficient stock at source location. Available: ${sourceInventory?.currentStock || 0}`);
        }

        return prisma.stockTransfer.create({
            data: {
                productId: params.productId,
                variantId: params.variantId,
                fromLocationId: params.fromLocationId,
                toLocationId: params.toLocationId,
                quantity: qty,
                status: "IN_TRANSIT",
                initiatedById: params.initiatedById,
                notes: params.notes
            },
            include: {
                product: true,
                fromLocation: true,
                toLocation: true
            }
        });
    }

    /**
     * Completes a transfer — safely adjusts inventory at both ends inside a single locked transaction.
     */
    static async completeTransfer(transferId: string, staffId?: string) {
        const transfer = await prisma.stockTransfer.findUnique({ where: { id: transferId } });
        if (!transfer || transfer.status !== "IN_TRANSIT") {
            throw new Error("Transfer not found or not in IN_TRANSIT status.");
        }

        const qty = transfer.quantity as Prisma.Decimal;

        await prisma.$transaction(async (tx) => {
            // Deduct from source (locks source row)
            await InventoryService.adjustGlobalInventory(tx, {
                productId: transfer.productId,
                variantId: transfer.variantId || undefined,
                locationId: transfer.fromLocationId,
                qtyDelta: -qty.toNumber(),
                referenceType: 'ADJUSTMENT',
                referenceId: transferId,
                staffId
            });

            // Add to destination (locks or creates destination row)
            await InventoryService.adjustGlobalInventory(tx, {
                productId: transfer.productId,
                variantId: transfer.variantId || undefined,
                locationId: transfer.toLocationId,
                qtyDelta: qty.toNumber(),
                referenceType: 'ADJUSTMENT',
                referenceId: transferId,
                staffId
            });

            await tx.stockTransfer.update({
                where: { id: transferId },
                data: { status: "COMPLETED", completedAt: new Date() }
            });
        });

        return { message: "Transfer successfully completed and ledger logged." };
    }

    static async getTransfers(params: { locationId?: string; status?: string }) {
        return prisma.stockTransfer.findMany({
            where: {
                ...(params.status && { status: params.status as any }),
                ...(params.locationId && {
                    OR: [
                        { fromLocationId: params.locationId },
                        { toLocationId: params.locationId }
                    ]
                })
            },
            include: {
                product: { select: { id: true, name: true } },
                fromLocation: { select: { id: true, name: true } },
                toLocation: { select: { id: true, name: true } },
                initiatedBy: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: "desc" }
        });
    }
}

export class PredictiveLowStockService {
    /**
     * Calculates sales velocity (last 24h) and predicts runout time.
     * Returns alerts for products expected to run out within 8 hours.
     */
    static async getLowStockAlerts(locationId: string) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Get all inventory for this location
        const inventories = await prisma.inventory.findMany({
            where: { locationId, currentStock: { gt: 0 } },
            include: { product: { select: { id: true, name: true, images: true } } }
        });

        const alerts = [];

        for (const inv of inventories) {
            // Sum SALE logs in last 24h
            const salesLogs = await prisma.inventoryLog.aggregate({
                where: {
                    productId: inv.productId,
                    locationId,
                    type: "SALE",
                    createdAt: { gte: since }
                },
                _sum: { delta: true }
            });

            const soldQty = Math.abs(Number(salesLogs._sum.delta || 0));
            const velocityPerHour = soldQty / 24;

            if (velocityPerHour === 0) continue; // No sales velocity — skip

            const hoursRemaining = inv.currentStock / velocityPerHour;
            const runoutAt = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);

            if (hoursRemaining < 8) {
                alerts.push({
                    product: inv.product,
                    currentStock: inv.currentStock,
                    velocityPerHour: parseFloat(velocityPerHour.toFixed(2)),
                    hoursRemaining: parseFloat(hoursRemaining.toFixed(1)),
                    runoutAt,
                    severity: hoursRemaining < 2 ? "CRITICAL" : hoursRemaining < 4 ? "HIGH" : "MEDIUM"
                });
            }
        }

        return alerts.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    }
}
