
import { Prisma, OrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { AccountingService } from "./accountingService";
import { InventoryService, InventoryLogType, StockDeductionItem } from "./inventoryService";
import { SecurityService } from "./securityService";
import { withTransactionRetry } from "../utils/transaction";
import crypto from "crypto";
import logger from "../utils/logger";

export interface BillingInputItem {
    productId: string;
    variantId?: string;
    quantity: number;
}

export interface BillingInput {
    channel: "WEB" | "POS" | "WHATSAPP";
    locationId: string;
    staffId?: string;
    userId: string;
    items: BillingInputItem[];
    payments: { method: string; amount: number | Prisma.Decimal }[];
    couponCode?: string;
    traceId: string; // Mandatory for idempotency
}

export class BillingService {
    /**
     * The definitive gateway for order creation.
     */
    static async createOrder(input: BillingInput) {
        // 1. Idempotency Check (Pre-Transaction)
        if (input.traceId) {
            const existingOrder = await prisma.order.findFirst({
                where: { idempotencyKey: input.traceId },
                include: { items: true, payments: true }
            });
            if (existingOrder) {
                return existingOrder;
            }
        }

        return await withTransactionRetry(async (tx) => {
            // 2. Fetch Pricing & Products
            const itemsWithPricing = await Promise.all(input.items.map(async (item) => {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    include: { pricing: { where: { channel: input.channel, isActive: true } } }
                });
                if (!product) throw new Error(`Product ${item.productId} not found`);

                let price = product.basePrice;
                if (item.variantId) {
                    const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
                    if (variant) price = variant.price;
                }

                if (product.pricing.length > 0) {
                    price = product.pricing[0].price;
                }

                return { ...item, price, sku: product.sku, taxSlab: product.taxSlab };
            }));

            const totalAmount = itemsWithPricing.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.price).mul(item.quantity)), new Prisma.Decimal(0));

            let activeShiftId: string | undefined;
            if (input.channel === "POS" && input.staffId) {
                const activeShift = await tx.cashierShift.findFirst({
                    where: { userId: input.staffId, status: "OPEN" }
                });
                if (!activeShift) throw new Error("No active cashier shift found. Mandatory for POS sales.");
                activeShiftId = activeShift.id;
            }

            const order = await tx.order.create({
                data: {
                    userId: input.userId,
                    totalAmount,
                    status: "PENDING",
                    paymentStatus: "PENDING",
                    shippingAddress: {},
                    channel: input.channel,
                    idempotencyKey: input.traceId,
                    shiftId: activeShiftId,
                    items: {
                        create: itemsWithPricing.map(item => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            quantity: item.quantity,
                            sellingPrice: item.price,
                            costPriceSnapshot: 0,
                            marginSnapshot: 0
                        }))
                    },
                    payments: {
                        create: input.payments.map(p => ({
                            method: p.method,
                            amount: p.amount,
                            status: "PENDING"
                        }))
                    }
                },
                include: { items: true }
            });

            await InventoryService.deductStock({
                items: input.items,
                locationId: input.locationId,
                type: InventoryLogType.SALE,
                staffId: input.staffId || "SYSTEM"
            }, tx);

            return order;
        });
    }

    /**
     * Core Atomic Refund Engine
     */
    static async processRefund(input: {
        orderId: string;
        staffId: string;
        eventId: string;
        traceId: string;
        reason?: string;
        items: { orderItemId: string; quantity: number; isSpoilage: boolean }[];
    }) {
        const existingRefund = await prisma.refund.findUnique({
            where: { idempotencyKey: input.traceId },
            include: { items: true }
        });
        if (existingRefund) return existingRefund;

        return await withTransactionRetry(async (tx) => {
            const activeShift = await tx.cashierShift.findFirst({
                where: { userId: input.staffId, status: "OPEN" }
            });
            if (!activeShift) throw new Error("No active cashier shift found for this operator. Mandatory for financial events.");

            const refundItemsToCreate: any[] = [];
            let totalRefundAmount = new Prisma.Decimal(0);

            for (const item of input.items) {
                const orderItem: any[] = await tx.$queryRaw`SELECT * FROM "OrderItem" WHERE id = ${item.orderItemId} FOR UPDATE`;
                if (!orderItem || orderItem.length === 0) throw new Error(`OrderItem ${item.orderItemId} not found.`);
                const oi = orderItem[0];

                const aggregates = await tx.refundItem.aggregate({
                    where: { orderItemId: item.orderItemId },
                    _sum: { quantityRefunded: true }
                });
                const previouslyRefunded = aggregates._sum.quantityRefunded || 0;
                const refundableQuantity = oi.quantity - previouslyRefunded;

                if (item.quantity > refundableQuantity) {
                    throw new Error(`Refund quantity exceeds refundable balance`);
                }

                const lineRefundAmount = new Prisma.Decimal(oi.sellingPrice).mul(item.quantity);
                totalRefundAmount = totalRefundAmount.plus(lineRefundAmount);

                refundItemsToCreate.push({
                    orderItemId: item.orderItemId,
                    quantityRefunded: item.quantity,
                    amountRefunded: lineRefundAmount,
                    originalSellingPriceSnapshot: oi.sellingPrice,
                    originalCostSnapshot: oi.costPriceSnapshot || 0,
                    isRestocked: !item.isSpoilage
                });
            }

            const refund = await tx.refund.create({
                data: {
                    orderId: input.orderId,
                    cashierShiftId: activeShift.id,
                    totalAmount: totalRefundAmount,
                    reason: input.reason,
                    idempotencyKey: input.traceId,
                    eventId: input.eventId,
                    items: { create: refundItemsToCreate }
                }
            });

            const coaSalesReturns = await tx.chartOfAccount.findUnique({ where: { code: "COA_SALES_RETURNS" } });
            const coaCash = await tx.chartOfAccount.findUnique({ where: { code: "COA_CASH" } });
            if (coaSalesReturns && coaCash) {
                await tx.journalEntry.create({
                    data: {
                        transactionId: `${input.traceId}_REV`,
                        locationId: activeShift.locationId || "N/A",
                        staffId: input.staffId,
                        reference: `REFUND_${refund.id}`,
                        description: `Refund for Order ${input.orderId}`,
                        ledgerEntries: {
                            create: [
                                { accountId: coaSalesReturns.id, debit: totalRefundAmount, credit: 0, locationId: activeShift.locationId || "N/A", fiscalYear: new Date().getFullYear(), fiscalMonth: new Date().getMonth() + 1 },
                                { accountId: coaCash.id, debit: 0, credit: totalRefundAmount, locationId: activeShift.locationId || "N/A", fiscalYear: new Date().getFullYear(), fiscalMonth: new Date().getMonth() + 1 }
                            ]
                        }
                    }
                });
            }

            const inventoryRestoreItems = [];
            for (const item of input.items) {
                const oi = await tx.orderItem.findUnique({ where: { id: item.orderItemId } });
                if (oi) {
                    inventoryRestoreItems.push({
                        productId: oi.productId,
                        variantId: oi.variantId || undefined,
                        quantity: item.quantity,
                        isSpoilage: item.isSpoilage
                    });
                }
            }

            await InventoryService.restoreStock({
                items: inventoryRestoreItems,
                locationId: activeShift.locationId || "N/A",
                staffId: input.staffId,
                referenceId: refund.id
            }, tx);

            const coaCogs = await tx.chartOfAccount.findUnique({ where: { code: "COA_COGS" } });
            const coaInv = await tx.chartOfAccount.findUnique({ where: { code: "COA_INVENTORY" } });
            if (coaCogs && coaInv) {
                let actualNonSpoiledCogs = new Prisma.Decimal(0);
                for (const ri of refundItemsToCreate) {
                    if (ri.isRestocked) {
                        actualNonSpoiledCogs = actualNonSpoiledCogs.plus(new Prisma.Decimal(ri.originalCostSnapshot).mul(ri.quantityRefunded));
                    }
                }
                if (actualNonSpoiledCogs.gt(0)) {
                    await tx.journalEntry.create({
                        data: {
                            transactionId: `${input.traceId}_COGS_REV`,
                            locationId: activeShift.locationId || "N/A",
                            staffId: input.staffId,
                            reference: `REFUND_${refund.id}`,
                            description: `COGS reversal`,
                            ledgerEntries: {
                                create: [
                                    { accountId: coaInv.id, debit: actualNonSpoiledCogs, credit: 0, locationId: activeShift.locationId || "N/A", fiscalYear: new Date().getFullYear(), fiscalMonth: new Date().getMonth() + 1 },
                                    { accountId: coaCogs.id, debit: 0, credit: actualNonSpoiledCogs, locationId: activeShift.locationId || "N/A", fiscalYear: new Date().getFullYear(), fiscalMonth: new Date().getMonth() + 1 }
                                ]
                            }
                        }
                    });
                }
            }

            return refund;
        });
    }

    static async openShift(input: { userId: string; locationId: string; openingBalance: number; openedBy: string }) {
        return await prisma.cashierShift.create({
            data: {
                userId: input.userId,
                locationId: input.locationId,
                openingBalance: new Prisma.Decimal(input.openingBalance),
                status: "OPEN",
                expectedCash: new Prisma.Decimal(input.openingBalance)
            }
        });
    }

    static async closeShift(input: { shiftId: string; declaredCash: number; closedBy: string; supervisorId?: string; reason?: string }) {
        return await withTransactionRetry(async (tx) => {
            const shift: any[] = await tx.$queryRaw`SELECT * FROM "CashierShift" WHERE id = ${input.shiftId} FOR UPDATE`;
            if (!shift || shift.length === 0) throw new Error("Shift not found.");
            const s = shift[0];
            if (s.status === "CLOSED") throw new Error("Shift already closed.");

            const variance = new Prisma.Decimal(input.declaredCash).minus(s.expectedCash);
            if (variance.abs().gt(50) && !input.supervisorId) {
                await SecurityService.logAudit({ tableName: "CashierShift", operation: "CLOSE_REJECTED", staffId: input.closedBy, severity: "WARNING", details: `Variance ₹${variance}` }, tx);
                throw new Error(`Variance exceeds ₹50. Supervisor override required.`);
            }

            if (input.supervisorId) {
                await tx.cashDrawerAdjustment.create({
                    data: { shiftId: input.shiftId, amount: variance, type: variance.lt(0) ? "SHORTAGE" : "OVERAGE", reason: input.reason || "Override", supervisorId: input.supervisorId, eventId: crypto.randomUUID() }
                });
            }

            return await tx.cashierShift.update({
                where: { id: input.shiftId },
                data: { status: "CLOSED", declaredCash: input.declaredCash, variance, endTime: new Date() }
            });
        });
    }
}
