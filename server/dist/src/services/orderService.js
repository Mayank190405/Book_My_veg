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
exports.orderService = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const appConfig_1 = require("../config/appConfig");
const transaction_1 = require("../utils/transaction");
const errors_1 = require("../utils/errors");
const inventoryService_1 = require("./inventoryService");
const couponService_1 = require("./couponService");
const autoCancelQueue_1 = require("../queues/autoCancelQueue");
const idGenerator_1 = require("../utils/idGenerator");
const paymentEligibilityService_1 = require("./paymentEligibilityService");
exports.orderService = {
    /**
     * Places an order with full validation and atomic guarantees.
     * Retries on transaction conflicts.
     */
    placeOrder(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield (0, transaction_1.withTransactionRetry)((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const { userId, address, items, totalAmount, deliverySlot, deliveryDate, couponCode, locationId: rootLocationId, paymentMethod } = data;
                // Resolve locationId
                let locationId = rootLocationId || (typeof address === 'object' ? address === null || address === void 0 ? void 0 : address.locationId : null);
                if (!locationId) {
                    const defaultLoc = yield tx.location.findFirst({ select: { id: true } });
                    locationId = defaultLoc === null || defaultLoc === void 0 ? void 0 : defaultLoc.id;
                }
                if (!locationId)
                    throw new Error("No active store location available.");
                console.log(`[OrderService] Using locationId: ${locationId} for fulfillment.`);
                // ── 1. Validate Slot Capacity ─────────────────────────────────────
                if (deliveryDate && deliverySlot) {
                    const activeOrdersInSlot = yield tx.order.count({
                        where: {
                            deliveryDate: new Date(deliveryDate),
                            deliverySlot: deliverySlot,
                            status: { notIn: ['CANCELLED', 'FAILED', 'RETURNED'] }
                        }
                    });
                    if (activeOrdersInSlot >= appConfig_1.appConfig.orders.slotCapacity) {
                        throw new errors_1.SlotFullError();
                    }
                }
                // ── 3. Stock Management (Reservation) ──────────────────────────────────────────
                yield inventoryService_1.InventoryService.reserveStock({
                    items,
                    locationId,
                    staffId: userId,
                }, tx);
                // ── 3.5 Fetch Selling Pricing & Category Info ─────────────────────────
                const enrichedItems = yield Promise.all(items.map((item) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    const product = yield tx.product.findUnique({
                        where: { id: item.productId },
                        select: { basePrice: true, categoryId: true, name: true }
                    });
                    let price = item.price;
                    if (!price) {
                        const pricing = yield tx.pricing.findFirst({
                            where: { productId: item.productId, channel: "WEB", isActive: true },
                            orderBy: { startDate: "desc" }
                        });
                        price = Number((_b = (_a = pricing === null || pricing === void 0 ? void 0 : pricing.price) !== null && _a !== void 0 ? _a : product === null || product === void 0 ? void 0 : product.basePrice) !== null && _b !== void 0 ? _b : 0);
                    }
                    let safeVariantId = null;
                    if (item.variantId) {
                        const validVariant = yield tx.productVariant.findUnique({
                            where: { id: item.variantId },
                            select: { id: true }
                        });
                        if (validVariant) {
                            safeVariantId = validVariant.id;
                        }
                    }
                    return {
                        productId: item.productId,
                        variantId: safeVariantId || undefined,
                        quantity: Number(item.quantity),
                        price,
                        categoryId: (product === null || product === void 0 ? void 0 : product.categoryId) || "",
                        name: (product === null || product === void 0 ? void 0 : product.name) || ""
                    };
                })));
                // ── 2. Validate Coupon ─────────────────────────
                let discountAmount = 0;
                let couponId = null;
                if (couponCode) {
                    const paymentMethodForCoupon = ((_a = data.paymentMetadata) === null || _a === void 0 ? void 0 : _a.method) || paymentMethod;
                    const pincode = typeof address === 'object' ? address === null || address === void 0 ? void 0 : address.pincode : undefined;
                    const couponResult = yield couponService_1.couponService.validateCoupon(tx, couponCode, totalAmount, userId, enrichedItems, paymentMethodForCoupon, pincode);
                    discountAmount = couponResult.discountAmount;
                    couponId = couponResult.id;
                    yield couponService_1.couponService.incrementUsage(tx, couponId);
                }
                const itemsSubtotal = enrichedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
                const computedDeliveryCharge = data.deliveryCharge !== undefined
                    ? data.deliveryCharge
                    : (itemsSubtotal >= 249 ? 0 : 40);
                const finalOrderAmount = totalAmount - discountAmount;
                let orderStatus = "CONFIRMED";
                const paymentRecords = [];
                if (paymentMethod === "ONLINE") {
                    orderStatus = "PAYMENT_PENDING";
                    paymentRecords.push({
                        amount: finalOrderAmount,
                        method: "ONLINE",
                        status: "PENDING",
                        transactionId: `PENDING_ON_${Date.now()}`
                    });
                }
                else {
                    // Customer requested COD (either full or partial COD)
                    const eligibility = yield (0, paymentEligibilityService_1.getPaymentEligibility)(userId, finalOrderAmount);
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
                    }
                    else {
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
                const newOrder = yield tx.order.create({
                    data: {
                        id: (0, idGenerator_1.generateOrderId)(),
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
                        status: orderStatus,
                        shippingAddress: address || {},
                        locationId: locationId,
                        items: {
                            create: enrichedItems.map((item) => ({
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
                    yield tx.payment.create({
                        data: Object.assign({ orderId: newOrder.id }, payRec)
                    });
                }
                // Create in-app system notification for the user (If no online payment is required initially)
                const hasOnlinePart = paymentRecords.some((p) => p.method === "ONLINE");
                if (!hasOnlinePart) {
                    yield tx.notification.create({
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
                yield tx.orderStatusHistory.create({
                    data: {
                        orderId: newOrder.id,
                        status: orderStatus,
                        remark: "Order placed" + (couponCode ? ` with coupon ${couponCode}` : ""),
                        changedBy: userId,
                    },
                });
                // ── 6. Clear Cart ─────────────────────────────────────────────────
                const cart = yield tx.cart.findUnique({ where: { userId } });
                if (cart) {
                    yield tx.cartItem.deleteMany({ where: { cartId: cart.id } });
                }
                // ── 7. Schedule Background Auto-Cancel ──────
                yield (0, autoCancelQueue_1.scheduleOrderAutoCancel)(newOrder.id);
                return newOrder;
            }));
            // ── WhatsApp Notification Dispatch (Outside Transaction Block) ─────
            if (order.status === "CONFIRMED") {
                try {
                    const user = yield prisma_1.default.user.findUnique({ where: { id: data.userId }, select: { phone: true } });
                    const phone = user === null || user === void 0 ? void 0 : user.phone;
                    if (phone) {
                        const { sendOrderConfirmationViaWhatsapp } = require("./mbgcard");
                        sendOrderConfirmationViaWhatsapp(phone, order.id, Number(order.totalAmount)).catch((err) => {
                            console.error("[OrderService] WhatsApp dispatch failure:", err);
                        });
                    }
                }
                catch (err) {
                    console.error("[OrderService] Failed to query user for WhatsApp:", err);
                }
            }
            return order;
        });
    },
    /**
     * Cancels an order and restores inventory.
     */
    cancelOrder(orderId, userId, _isAdmin, remark) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, transaction_1.withTransactionRetry)((tx) => __awaiter(this, void 0, void 0, function* () {
                const order = yield tx.order.findUnique({
                    where: { id: orderId },
                    include: { items: true }
                });
                if (!order)
                    throw new Error("Order not found");
                yield inventoryService_1.InventoryService.restoreStock({
                    items: order.items.map((i) => ({
                        productId: i.productId,
                        variantId: i.variantId,
                        quantity: i.quantity
                    })),
                    locationId: order.locationId || "MAIN_WAREHOUSE",
                    staffId: userId,
                    referenceId: `CANCEL_${order.id}`
                }, tx);
                // Update Status
                yield tx.order.update({
                    where: { id: orderId },
                    data: { status: "CANCELLED" },
                });
                // Log History
                yield tx.orderStatusHistory.create({
                    data: {
                        orderId,
                        status: "CANCELLED",
                        remark,
                        changedBy: userId || "SYSTEM",
                    },
                });
            }));
        });
    }
};
