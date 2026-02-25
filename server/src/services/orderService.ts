import { OrderStatus as PrismaOrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { appConfig } from "../config/appConfig";
import { withTransactionRetry } from "../utils/transaction";
import { SlotFullError } from "../utils/errors";
import { InventoryService } from "./inventoryService";
import { couponService } from "./couponService";

interface PlaceOrderDTO {
    userId: string;
    address: any;
    items: { productId: string; quantity: number; price: number; variantId?: string; unit?: string }[];
    totalAmount: number;
    deliverySlot?: string;
    deliveryDate?: string | Date;
    couponCode?: string;
    channel?: "WEB" | "POS" | "WHATSAPP";
    taxAmount?: number;
    isPaid?: boolean;
    notes?: string;
    shiftId?: string;
    locationId?: string;
    isCredit?: boolean;
    packerId?: string;
    manualDiscount?: number;
    discountType?: "FIXED" | "PERCENTAGE";
    paymentMetadata?: {
        cashDenominations?: any;
        cashEntered?: number;
        changeGiven?: number;
        method?: string;
    };
}

export const orderService = {
    /**
     * Process an existing WEB order at POS (Pickup).
     * Deducts inventory without recording a new sale transaction.
     */
    async processWebOrder(orderId: string, locationId: string, staffId: string) {
        return await withTransactionRetry(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });

            if (!order) throw new Error("Order not found");
            if (order.status === "DELIVERED" || order.status === "CANCELLED") {
                throw new Error("Order already processed or cancelled");
            }

            // Deduct stock
            await InventoryService.deductStock({
                items: order.items.map((i: any) => ({
                    productId: i.productId,
                    variantId: i.variantId || undefined,
                    quantity: i.quantity
                })),
                locationId,
                type: "SALE" as any, // Standard sale deduction
                staffId
            }, tx);

            // Update Status
            const updated = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: "DELIVERED" as PrismaOrderStatus,
                    packedAt: new Date()
                }
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId,
                    status: "DELIVERED" as PrismaOrderStatus,
                    remark: "Processed & picked up via POS",
                    changedBy: staffId
                }
            });

            return updated;
        });
    },

    /**
     * Places an order with full validation and atomic guarantees.
     * Retries on transaction conflicts.
     */
    async placeOrder(data: PlaceOrderDTO) {
        return await withTransactionRetry(async (tx) => {
            const { userId, address, items, totalAmount, deliverySlot, deliveryDate, couponCode, paymentMetadata, manualDiscount, discountType } = data;

            // ── 1. Validate Slot Capacity ─────────────────────────────────────
            if (deliveryDate && deliverySlot) {
                const activeOrdersInSlot = await tx.order.count({
                    where: {
                        deliveryDate: new Date(deliveryDate),
                        deliverySlot: deliverySlot,
                        status: { notIn: ['CANCELLED', 'FAILED', 'RETURNED'] }
                    }
                });

                if (activeOrdersInSlot >= appConfig.orders.slotCapacity) {
                    throw new SlotFullError();
                }
            }

            // ── 2. Validate Coupon & Manual Discounts ─────────────────────────
            let discountAmount = 0;
            let couponId = null;

            if (manualDiscount && manualDiscount > 0) {
                if (discountType === "PERCENTAGE") {
                    discountAmount = (totalAmount * manualDiscount) / 100;
                } else {
                    discountAmount = manualDiscount;
                }
            } else if (couponCode) {
                const couponResult = await couponService.validateCoupon(tx, couponCode, totalAmount);
                discountAmount = couponResult.discountAmount;
                couponId = couponResult.id;
                await couponService.incrementUsage(tx, couponId);
            }

            // ── 3. Stock Management ──────────────────────────────────────────
            if (data.channel === "POS") {
                if (!data.locationId) throw new Error("Location ID is required for POS orders");

                // Compulsory Customer Tagging for POS (SYSTEM-POS is not allowed as a customer)
                if (userId === "SYSTEM-POS" || !userId) {
                    throw new Error("Customer tagging is mandatory for POS transactions.");
                }

                // For POS, immediate deduction (FIFO)
                await InventoryService.deductStock({
                    items,
                    locationId: data.locationId,
                    type: "SALE" as any,
                    staffId: userId
                }, tx);
            } else {
                // For Web/WhatsApp, reserve stock (currently shim, but keeps flow)
                await InventoryService.reserveStock(tx, items);
            }

            // ── 3.5 Fetch Cost Pricing for Margin ─────────────────────────
            const enrichedItems = await Promise.all(items.map(async (item) => {
                const latestBatch = await tx.batch.findFirst({
                    where: { productId: item.productId, remainingQty: { gt: 0 } },
                    orderBy: { receivedDate: "desc" }
                });
                const costPrice = Number(latestBatch?.costPrice || 0);
                const margin = item.price - costPrice;
                return { ...item, costPrice, margin };
            }));

            // ── 4. Create Order ───────────────────────────────────────────────
            const newOrder = await tx.order.create({
                data: {
                    userId,
                    totalAmount: totalAmount - discountAmount,
                    discountAmount,
                    taxAmount: data.taxAmount || 0,
                    channel: data.channel || "WEB",
                    isPaid: data.isPaid || false,
                    notes: data.notes,
                    shiftId: data.shiftId,
                    couponId,
                    deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
                    deliverySlot,
                    paymentStatus: data.isPaid ? "PAID" : "PENDING",
                    status: (data.channel === "POS" && data.isPaid) ? "DELIVERED" : ("PAYMENT_PENDING" as PrismaOrderStatus),
                    shippingAddress: address || {},
                    isCredit: data.isCredit || false,
                    packerId: data.packerId,
                    items: {
                        create: enrichedItems.map((item: any) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            quantity: item.quantity,
                            sellingPrice: item.price,
                            costPriceSnapshot: item.costPrice,
                            marginSnapshot: item.margin,
                        })),
                    },
                },
            });

            // ── 5. Handle Payment & Khata (Credit) ──────────────────────────
            if (data.isPaid || data.isCredit) {
                await tx.payment.create({
                    data: {
                        orderId: newOrder.id,
                        amount: newOrder.totalAmount,
                        method: paymentMetadata?.method || (data.isCredit ? "CREDIT" : (data.channel === "POS" ? "CASH" : "ONLINE")),
                        status: data.isPaid ? "COMPLETED" : "PENDING",
                        denominations: paymentMetadata?.cashDenominations || {},
                        changeGiven: paymentMetadata?.changeGiven || 0,
                        metadata: paymentMetadata ? {
                            cashEntered: paymentMetadata.cashEntered,
                            posShiftId: data.shiftId
                        } : undefined
                    }
                });
            }

            if (data.channel === "POS" && data.isCredit) {
                await tx.customerKhata.upsert({
                    where: { userId },
                    update: { outstanding: { increment: newOrder.totalAmount } },
                    create: { userId, outstanding: newOrder.totalAmount, creditLimit: 5000 } // Default limit
                });

                await tx.khataTransaction.create({
                    data: {
                        khataId: (await tx.customerKhata.findUnique({ where: { userId } }))?.id || "",
                        type: "PURCHASE",
                        amount: newOrder.totalAmount,
                        orderId: newOrder.id,
                        notes: "POS Credit Sale"
                    }
                });
            }

            // ── 6. Create Status History ──────────────────────────────────────
            await tx.orderStatusHistory.create({
                data: {
                    orderId: newOrder.id,
                    status: "PAYMENT_PENDING" as PrismaOrderStatus,
                    remark: "Order placed" + (couponCode ? ` with coupon ${couponCode}` : ""),
                    changedBy: userId,
                },
            });

            // ── 6. Clear Cart ─────────────────────────────────────────────────
            const cart = await tx.cart.findUnique({ where: { userId } });
            if (cart) {
                await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
            }

            return newOrder;
        });
    },

    /**
     * Cancels an order and restores inventory.
     */
    async cancelOrder(orderId: string, userId: string, isAdmin: boolean, remark: string) {
        return await withTransactionRetry(async (tx) => {
            // Restore Inventory
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });

            if (!order) throw new Error("Order not found");

            if (order.channel === "POS" && order.shiftId) {
                const shift = await tx.cashierShift.findUnique({ where: { id: order.shiftId } });
                if (shift?.locationId) {
                    await InventoryService.restoreStock({
                        items: order.items.map((i: any) => ({
                            productId: i.productId,
                            variantId: i.variantId,
                            quantity: i.quantity
                        })),
                        locationId: shift.locationId,
                        staffId: userId,
                        referenceId: `CANCEL_${order.id}`
                    }, tx);
                }
            } else {
                await InventoryService.restoreStock({
                    items: order.items.map((i: any) => ({
                        productId: i.productId,
                        variantId: i.variantId,
                        quantity: i.quantity
                    })),
                    locationId: "DEFAULT_LOCATION",
                    staffId: userId,
                    referenceId: `CANCEL_${order.id}`
                }, tx);
            }

            // Update Status
            await tx.order.update({
                where: { id: orderId },
                data: { status: "CANCELLED" as PrismaOrderStatus },
            });

            // Log History
            await tx.orderStatusHistory.create({
                data: {
                    orderId,
                    status: "CANCELLED" as PrismaOrderStatus,
                    remark,
                    changedBy: userId || "SYSTEM",
                },
            });
        });
    }
};
