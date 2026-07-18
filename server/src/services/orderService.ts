import { OrderStatus as PrismaOrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { appConfig } from "../config/appConfig";
import { withTransactionRetry } from "../utils/transaction";
import { SlotFullError } from "../utils/errors";
import { InventoryService } from "./inventoryService";
import { couponService } from "./couponService";
import { scheduleOrderAutoCancel } from "../queues/autoCancelQueue";
import { generateOrderId } from "../utils/idGenerator";
import { getPaymentEligibility } from "./paymentEligibilityService";

interface PlaceOrderDTO {
    userId: string;
    address: any;
    items: { productId: string; quantity: number; price: number; variantId?: string; unit?: string }[];
    totalAmount: number;
    deliverySlot?: string;
    deliveryDate?: string | Date;
    couponCode?: string;
    taxAmount?: number;
    deliveryCharge?: number;
    notes?: string;
    locationId?: string;
    paymentMethod?: string;
    paymentMetadata?: {
        method?: string;
    };
}

export const orderService = {
    /**
     * Places an order with full validation and atomic guarantees.
     * Retries on transaction conflicts.
     */
    async placeOrder(data: PlaceOrderDTO) {
        const order = await withTransactionRetry(async (tx) => {
            const { userId, address, items, totalAmount, deliverySlot, deliveryDate, couponCode, locationId: rootLocationId, paymentMethod } = data;
            
            // Resolve locationId
            let locationId = rootLocationId || (typeof address === 'object' ? address?.locationId : null);
            if (!locationId) {
                const defaultLoc = await tx.location.findFirst({ select: { id: true } });
                locationId = defaultLoc?.id;
            }
            
            if (!locationId) throw new Error("No active store location available.");
            
            console.log(`[OrderService] Using locationId: ${locationId} for fulfillment.`);

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

            // ── 3. Stock Management (Reservation) ──────────────────────────────────────────
            await InventoryService.reserveStock({
                items,
                locationId,
                staffId: userId,
            }, tx);

            // ── 3.5 Fetch Selling Pricing & Category Info ─────────────────────────
            const enrichedItems = await Promise.all(items.map(async (item) => {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { basePrice: true, categoryId: true, name: true }
                });
                let price = item.price;
                if (!price) {
                    const pricing = await tx.pricing.findFirst({
                        where: { productId: item.productId, channel: "WEB", isActive: true },
                        orderBy: { startDate: "desc" }
                    });
                    price = Number(pricing?.price ?? product?.basePrice ?? 0);
                }
                return { 
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: Number(item.quantity),
                    price,
                    categoryId: product?.categoryId || "",
                    name: product?.name || ""
                };
            }));

            // ── 2. Validate Coupon ─────────────────────────
            let discountAmount = 0;
            let couponId = null;

            if (couponCode) {
                const paymentMethodForCoupon = data.paymentMetadata?.method || paymentMethod;
                const pincode = typeof address === 'object' ? address?.pincode : undefined;

                const couponResult = await couponService.validateCoupon(
                    tx, 
                    couponCode, 
                    totalAmount, 
                    userId, 
                    enrichedItems, 
                    paymentMethodForCoupon, 
                    pincode
                );
                discountAmount = couponResult.discountAmount;
                couponId = couponResult.id;
                await couponService.incrementUsage(tx, couponId);
            }

            const itemsSubtotal = enrichedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
            const computedDeliveryCharge = data.deliveryCharge !== undefined 
                ? data.deliveryCharge 
                : (itemsSubtotal >= 249 ? 0 : 40);

            const finalOrderAmount = totalAmount - discountAmount;
            let orderStatus = "CONFIRMED";
            const paymentRecords: any[] = [];

            if (paymentMethod === "ONLINE") {
                orderStatus = "PAYMENT_PENDING";
                paymentRecords.push({
                    amount: finalOrderAmount,
                    method: "ONLINE",
                    status: "PENDING",
                    transactionId: `PENDING_ON_${Date.now()}`
                });
            } else {
                // Customer requested COD (either full or partial COD)
                const eligibility = await getPaymentEligibility(userId, finalOrderAmount);
                if (!eligibility.codAllowed) {
                    throw new Error("COD is not allowed for your first order. Please choose online payment.");
                }

                if (eligibility.advanceAmount > 0) {
                    // Partial COD
                    orderStatus = "PAYMENT_PENDING";
                    paymentRecords.push({
                        amount: eligibility.advanceAmount,
                        method: "ONLINE",
                        status: "PENDING",
                        transactionId: `PENDING_ADV_${Date.now()}`
                    });
                    paymentRecords.push({
                        amount: eligibility.codAmount,
                        method: "COD",
                        status: "PENDING",
                        transactionId: `PENDING_BAL_${Date.now()}`
                    });
                } else {
                    // Full COD allowed
                    orderStatus = "CONFIRMED";
                    paymentRecords.push({
                        amount: finalOrderAmount,
                        method: "COD",
                        status: "PENDING",
                        transactionId: `PENDING_COD_${Date.now()}`
                    });
                }
            }

            const newOrder = await tx.order.create({
                data: {
                    id: generateOrderId(),
                    userId,
                    totalAmount: finalOrderAmount,
                    discountAmount,
                    taxAmount: data.taxAmount || 0,
                    deliveryCharge: computedDeliveryCharge,
                    channel: "WEB",
                    isPaid: false,
                    notes: data.notes,
                    couponId,
                    deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
                    deliverySlot,
                    paymentStatus: "PENDING",
                    status: orderStatus as PrismaOrderStatus,
                    shippingAddress: address || {},
                    locationId: locationId,
                    items: {
                        create: enrichedItems.map((item: any) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            quantity: item.quantity,
                            sellingPrice: item.price,
                            locationId: locationId
                        })),
                    },
                },
            });

            // Create payment records
            for (const payRec of paymentRecords) {
                await tx.payment.create({
                    data: {
                        orderId: newOrder.id,
                        ...payRec
                    }
                });
            }

            // Create in-app system notification for the user (If no online payment is required initially)
            const hasOnlinePart = paymentRecords.some((p: any) => p.method === "ONLINE");
            if (!hasOnlinePart) {
                await tx.notification.create({
                    data: {
                        userId: userId,
                        title: "Order Confirmed",
                        body: `Your Cash on Delivery order #${newOrder.id} of ₹${newOrder.totalAmount} is confirmed!`,
                        type: "ORDER",
                        isRead: false
                    }
                });
            }

            // ── 5. Create Status History ──────────────────────────────────────
            await tx.orderStatusHistory.create({
                data: {
                    orderId: newOrder.id,
                    status: orderStatus as PrismaOrderStatus,
                    remark: "Order placed" + (couponCode ? ` with coupon ${couponCode}` : ""),
                    changedBy: userId,
                },
            });

            // ── 6. Clear Cart ─────────────────────────────────────────────────
            const cart = await tx.cart.findUnique({ where: { userId } });
            if (cart) {
                await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
            }

            // ── 7. Schedule Background Auto-Cancel ──────
            await scheduleOrderAutoCancel(newOrder.id);

            return newOrder;
        });

        // ── WhatsApp Notification Dispatch (Outside Transaction Block) ─────
        if (order.status === "CONFIRMED") {
            try {
                const user = await prisma.user.findUnique({ where: { id: data.userId }, select: { phone: true } });
                const phone = user?.phone;
                if (phone) {
                    const { sendOrderConfirmationViaWhatsapp } = require("./mbgcard");
                    sendOrderConfirmationViaWhatsapp(phone, order.id, Number(order.totalAmount)).catch((err: any) => {
                        console.error("[OrderService] WhatsApp dispatch failure:", err);
                    });
                }
            } catch (err) {
                console.error("[OrderService] Failed to query user for WhatsApp:", err);
            }
        }

        return order;
    },

    /**
     * Cancels an order and restores inventory.
     */
    async cancelOrder(orderId: string, userId: string, _isAdmin: boolean, remark: string) {
        return await withTransactionRetry(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });

            if (!order) throw new Error("Order not found");

            await InventoryService.restoreStock({
                items: order.items.map((i: any) => ({
                    productId: i.productId,
                    variantId: i.variantId,
                    quantity: i.quantity
                })),
                locationId: order.locationId || "MAIN_WAREHOUSE",
                staffId: userId,
                referenceId: `CANCEL_${order.id}`
            }, tx);

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
