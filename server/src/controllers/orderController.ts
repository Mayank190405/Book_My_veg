import { Request, Response, NextFunction } from "express";
import { OrderStatus as PrismaOrderStatus, Prisma, Channel } from "@prisma/client";
import prisma from "../config/prisma";
import { io } from "../index";
import {
    assertValidTransition,
    assertCancellable,
    OrderStatus,
    InvalidTransitionError,
    CancellationNotAllowedError,
} from "../utils/orderStateMachine";
import logger from "../utils/logger";
import { scheduleOrderAutoCancel } from "../queues/autoCancelQueue";
import { orderService } from "../services/orderService";
import { AppError } from "../utils/errors";
import { getIo } from "../sockets/io";
import { generateOtp, storeOtp, verifyOtp } from "../utils/otp";
import { sendOtpViaWhatsapp } from "../services/mbgcard";
import { generateOrderId } from "../utils/idGenerator";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string; locationId?: string; name?: string };
}

// ─── Assigning Operations ─────────────────────────────────────────────────────

export const assignPacker = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { packerId } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const order = await prisma.order.update({
            where: { id: id as string },
            data: { 
                packer: packerId ? { connect: { id: packerId } } : undefined,
                status: "PROCESSING" as PrismaOrderStatus,
                statusHistory: {
                    create: {
                        status: "PROCESSING" as PrismaOrderStatus,
                        remark: "Assigned to Packer",
                        changedBy: userId
                    }
                }
            } as any
        });

        // 🔔 Specific Bell for the Packer
        getIo().to(packerId).emit("OP_NEW_ORDER", { 
            id: order.id, 
            status: "PROCESSING",
            type: "PACKING"
        });

        res.json({ message: "Packer assigned successfully", order });
    } catch (error) {
        next(error);
    }
};

export const assignDriver = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { driverId } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const order = await prisma.order.update({
            where: { id: id as string },
            data: { 
                deliveryPartner: driverId ? { connect: { id: driverId } } : undefined,
                status: "SHIPPED" as PrismaOrderStatus,
                statusHistory: {
                    create: {
                        status: "SHIPPED" as PrismaOrderStatus,
                        remark: "Assigned to Delivery Partner",
                        changedBy: userId
                    }
                }
            }
        });

        // 🔔 Specific Bell for the Driver
        getIo().to(driverId).emit("OP_NEW_ORDER", { 
            id: order.id, 
            status: "SHIPPED",
            type: "DELIVERY"
        });

        res.json({ message: "Driver assigned successfully", order });
    } catch (error) {
        next(error);
    }
};

// ─── place order ─────────────────────────────────────────────────────────────

export const createOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const { paymentMetadata, ...orderParams } = req.body;
        const order = await orderService.placeOrder({
            userId,
            paymentMetadata,
            ...orderParams
        });

        // Schedule auto-cancel
        await scheduleOrderAutoCancel(order.id);

        logger.info("Order created", { orderId: order.id, userId });
        res.status(201).json(order);
    } catch (error) {
        next(error);
    }
};

// ─── get user orders (cursor-based) ─────────────────────────────────────────

export const getOrders = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // ── FIX 2: Cursor pagination ───────────────────────────────────────────
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

    try {
        const orders = await prisma.order.findMany({
            where: { userId },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                items: { include: { product: true } },
                location: true,
                payments: true,
            },
            orderBy: { createdAt: "desc" },
        });

        const hasMore = orders.length > limit;
        const data = hasMore ? orders.slice(0, limit) : orders;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        res.json({ data, nextCursor });
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders" });
    }
};

// ─── get single order ────────────────────────────────────────────────────────

export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const order = await prisma.order.findFirst({
            where: { id, userId },
            include: {
                items: { include: { product: true } },
                statusHistory: { orderBy: { createdAt: "asc" } },
                payments: true,
                deliveryPartner: { select: { name: true, phone: true } },
                location: true,
            },
        });

        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Error fetching order detail" });
    }
};

// ─── cancel order ─────────────────────────────────────────────────────────────

export const cancelOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === "ADMIN";
    const remark = req.body.remark || (isAdmin ? "Cancelled by admin" : "Cancelled by user");

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        await orderService.cancelOrder(id, userId, isAdmin, remark);
        res.json({ message: "Order cancelled successfully" });
    } catch (error) {
        next(error);
    }
};

export const getAllOrders = async (req: AuthenticatedRequest, res: Response) => {
    // Basic pagination
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = req.query.cursor ? (req.query.cursor as string) : undefined;

    try {
        const orders = await prisma.order.findMany({
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                user: { include: { addresses: { where: { isDefault: true }, take: 1 } } },
                items: { include: { product: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const hasMore = orders.length > limit;
        const data = hasMore ? orders.slice(0, limit) : orders;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        res.json({ data, nextCursor });
    } catch (error) {
        res.status(500).json({ message: "Error fetching all orders" });
    }
};

export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, remark, deliveryPartnerId, deliveryPhoto, deliveryOtp } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const order = await prisma.order.findUnique({ where: { id: id as string } });
        if (!order) return res.status(404).json({ message: "Order not found" });

        // Logic for delivery verification if user is a driver
        if (status === "DELIVERED" && req.user?.role === "DELIVERY_PARTNER") {
            if (!deliveryOtp) {
                return res.status(400).json({ message: "Delivery OTP is required to complete delivery" });
            }
            const isOtpValid = await verifyOtp(`DELIVERY_${id}`, deliveryOtp);
            if (!isOtpValid) {
                return res.status(400).json({ message: "Invalid or expired Delivery OTP" });
            }
        }

        const updated = await prisma.order.update({
            where: { id: id as string },
            data: { 
                status: status as PrismaOrderStatus,
                ...(deliveryPartnerId && { deliveryPartnerId }),
                ...(deliveryPhoto && { deliveryPhoto }),
                statusHistory: {
                    create: {
                        status: status as PrismaOrderStatus,
                        remark: remark || `Status updated to ${status}${deliveryPartnerId ? ' (Driver Assigned)' : ''}${deliveryOtp ? ' (OTP Verified)' : ''}${deliveryPhoto ? ' (Photo Attached)' : ''}`,
                        changedBy: userId
                    }
                }
            }
        });

        // Automatically complete COD payment and mark order paid when status is DELIVERED
        if (status === "DELIVERED") {
            const pendingCodPayment = await prisma.payment.findFirst({
                where: { orderId: id as string, method: "COD", status: "PENDING" }
            });
            if (pendingCodPayment) {
                await prisma.$transaction([
                    prisma.payment.update({
                        where: { id: pendingCodPayment.id },
                        data: { status: "SUCCESS", transactionId: `DELIVERED_${Date.now()}` }
                    }),
                    prisma.order.update({
                        where: { id: id as string },
                        data: { isPaid: true, paymentStatus: "COMPLETED" }
                    })
                ]);
            } else {
                await prisma.order.update({
                    where: { id: id as string },
                    data: { isPaid: true, paymentStatus: "COMPLETED" }
                });
            }

            // Trigger feedback request WhatsApp notification!
            try {
                const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { name: true, phone: true } });
                if (user?.phone) {
                    const { sendFeedbackRequestViaWhatsapp } = require("../services/mbgcard");
                    sendFeedbackRequestViaWhatsapp(user.phone, user.name || "Customer", id as string).catch((err: any) => {
                        console.error("[OrderController] WhatsApp feedback dispatch failure:", err);
                    });
                }
            } catch (err) {
                console.error("[OrderController] Failed to send WhatsApp feedback:", err);
            }
        }

        // Create Audit Log
        await (prisma.auditLog.create as any)({
            data: {
                entityType: "ORDER",
                entityId: id,
                action: `STATUS_UPDATE_${status}`,
                staffId: userId?.startsWith("STORE_") ? null : userId,
                locationId: req.user?.locationId,
                newValue: { status, remark }
            }
        });

        // Trigger status update WhatsApp notification!
        try {
            const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { name: true, phone: true } });
            if (user?.phone) {
                const { sendOrderStatusUpdateViaWhatsapp } = require("../services/mbgcard");
                sendOrderStatusUpdateViaWhatsapp(user.phone, user.name || "Customer", id as string, status).catch((err: any) => {
                    console.error("[OrderController] WhatsApp status update dispatch failure:", err);
                });
            }
        } catch (err) {
            console.error("[OrderController] Failed to send WhatsApp status update:", err);
        }

        res.json(updated);
    } catch (error) {
        next(error);
    }
};

export const getOrdersForPacking = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const locationId = req.user?.locationId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const orders = await prisma.order.findMany({
            where: {
                locationId,
                status: {
                    in: ["CONFIRMED", "PROCESSING"]
                }
            },
            include: {
                user: { include: { addresses: { where: { isDefault: true }, take: 1 } } },
                items: { include: { product: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        res.json({ data: orders });
    } catch (error) {
        res.status(500).json({ message: "Error fetching packing assignments" });
    }
};

export const getPackedOrdersCount = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const count = await (prisma.order.count as any)({
            where: { packerId: userId }
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Error fetching packed orders count" });
    }
};

export const updatePackingDetails = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { packerPhoto, packerNotes, status } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const updated = await (prisma.order.update as any)({
            where: { id: id as string },
            data: {
                status: (status || "PACKED") as PrismaOrderStatus,
                packerId: userId,
                packedAt: new Date(),
                packerPhoto: packerPhoto || null,
                packerNotes: packerNotes || null,
                statusHistory: {
                    create: {
                        status: (status || "PACKED") as PrismaOrderStatus,
                        remark: `Order marked as packed by packer. ${packerNotes ? 'Notes: ' + packerNotes : ''}`,
                        changedBy: userId
                    }
                }
            }
        });
        // Create Audit Log
        await (prisma.auditLog.create as any)({
            data: {
                entityType: "ORDER",
                entityId: id,
                action: "ORDER_PACKED",
                staffId: userId?.startsWith("STORE_") ? null : userId,
                locationId: req.user?.locationId,
                newValue: { status: status || "PACKED", notes: packerNotes }
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Error updating packing details" });
    }
};

export const updateOrderPaymentStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { isPaid } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const order = await prisma.order.findUnique({ where: { id: id as string } });
        if (!order) return res.status(404).json({ message: "Order not found" });

        const updated = await prisma.$transaction(async (tx) => {
            const upd = await tx.order.update({
                where: { id: id as string },
                data: { 
                    isPaid,
                    paymentStatus: isPaid ? "COMPLETED" : "PENDING",
                    statusHistory: {
                        create: {
                            status: order.status,
                            remark: isPaid ? "Payment manually marked as PAID by admin/staff" : "Payment manually marked as UNPAID by admin/staff",
                            changedBy: userId
                        }
                    }
                }
            });

            if (isPaid) {
                // Find existing pending payment and update it to SUCCESS
                const pendingPayment = await tx.payment.findFirst({
                    where: { orderId: id as string, status: "PENDING" }
                });

                if (pendingPayment) {
                    await tx.payment.update({
                        where: { id: pendingPayment.id },
                        data: {
                            status: "SUCCESS",
                            method: order.channel === "POS" ? "CASH" : "COD"
                        }
                    });
                } else {
                    // Create new successful payment record
                    await tx.payment.create({
                        data: {
                            orderId: id as string,
                            amount: order.totalAmount,
                            method: order.channel === "POS" ? "CASH" : "COD",
                            status: "SUCCESS",
                            transactionId: `MANUAL_${Date.now()}`
                        }
                    });
                }
            } else {
                // Mark successful payments back to PENDING
                await tx.payment.updateMany({
                    where: { orderId: id as string, status: "SUCCESS" },
                    data: { status: "PENDING" }
                });
            }

            return upd;
        });

        // Create Audit Log
        await (prisma.auditLog.create as any)({
            data: {
                entityType: "ORDER",
                entityId: id,
                action: isPaid ? "PAYMENT_COLLECTED" : "PAYMENT_REVERSED",
                staffId: userId?.startsWith("STORE_") ? null : userId,
                locationId: req.user?.locationId,
                newValue: { isPaid }
            }
        });

        res.json(updated);
    } catch (error) {
        next(error);
    }
};

export const sendDeliveryOtp = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    try {
        const order = await (prisma.order.findUnique as any)({
            where: { id },
            include: { user: true }
        });
        
        if (!order || !(order as any).user?.phone) {
            return res.status(404).json({ message: "Order or customer phone not found" });
        }

        const otp = generateOtp();
        await storeOtp(`DELIVERY_${id}`, otp);

        try {
            await sendOtpViaWhatsapp((order as any).user.phone, otp);
            res.json({ message: "Delivery OTP sent via WhatsApp" });
        } catch (e: any) {
            console.error("WhatsApp delivery failed, fallback OTP used.", e);
            res.json({ message: "OTP provider failed, check logs or use default if in sandbox", fallbackOtp: process.env.NODE_ENV !== "production" ? otp : undefined });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to send delivery OTP" });
    }
};

export const extractBillId = (qrData: string): string => {
    if (!qrData) return "";
    let str = String(qrData).trim();

    // Check if JSON
    try {
        if (str.startsWith("{") && str.endsWith("}")) {
            const parsed = JSON.parse(str);
            if (parsed.orderId) return String(parsed.orderId).trim();
            if (parsed.id) return String(parsed.id).trim();
            if (parsed.billId) return String(parsed.billId).trim();
        }
    } catch (e) {
        // Not JSON
    }

    if (str.includes("billid=")) {
        const match = str.match(/billid=([^&]+)/);
        if (match) return decodeURIComponent(match[1]).trim();
    }
    if (str.includes("/invoice/")) {
        const parts = str.split("/invoice/");
        if (parts[1]) return parts[1].split("?")[0].split("/")[0].trim();
    }
    if (str.includes("/orders/")) {
        const parts = str.split("/orders/");
        if (parts[1]) return parts[1].split("?")[0].split("/")[0].trim();
    }
    if (str.includes("/pay/")) {
        const afterPay = str.split("/pay/")[1];
        if (afterPay) {
            const match = afterPay.match(/billid=([^&]+)/);
            if (match) return decodeURIComponent(match[1]).trim();
            const directId = afterPay.split("?")[0].split("/")[0].trim();
            if (directId) return directId;
        }
    }
    if (str.includes("tr=") || str.includes("tn=")) {
        const trMatch = str.match(/[?&]tr=([^&]+)/);
        if (trMatch) return decodeURIComponent(trMatch[1]).trim();
        const tnMatch = str.match(/[?&]tn=([^&]+)/);
        if (tnMatch) return decodeURIComponent(tnMatch[1]).trim();
    }
    return str;
};

// ─── Packer Manual Order Creation (e.g. WhatsApp orders) ─────────────────────
export const createPackerOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const locationId = req.user?.locationId;
    const { 
        customerId, 
        customerName, 
        customerPhone, 
        customerAddress, 
        items, 
        notes,
        packerNotes,
        packerPhoto,
        isDelivery = true
    } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Order must contain at least one item." });
    }

    try {
        let finalUserId = customerId;
        if (!finalUserId) {
            if (!customerPhone) {
                return res.status(400).json({ message: "Customer phone is required to create order." });
            }
            const cleanPhone = customerPhone.replace(/\D/g, "");
            let user = await prisma.user.findFirst({
                where: { OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        phone: cleanPhone,
                        name: customerName || "WhatsApp Customer",
                        profileAddress: customerAddress || null
                    }
                });
                if (customerAddress) {
                    await prisma.address.create({
                        data: {
                            userId: user.id,
                            fullAddress: customerAddress,
                            name: customerName || user.name,
                            phone: cleanPhone,
                            isDefault: true
                        }
                    });
                }
            }
            finalUserId = user.id;
        }

        // Calculate totals
        let totalAmount = 0;
        const itemCreates = [];

        for (const item of items) {
            let sellingPrice = Number(item.sellingPrice || item.price || 0);
            if (!sellingPrice && (item.productId || item.id)) {
                const prod = await prisma.product.findUnique({
                    where: { id: item.productId || item.id },
                    include: { variants: true }
                });
                if (prod) {
                    sellingPrice = Number(prod.basePrice || 0);
                    if (item.variantId) {
                        const variant = prod.variants.find((v: any) => v.id === item.variantId);
                        if (variant) sellingPrice = Number(variant.price);
                    }
                }
            }
            const qty = Number(item.quantity || 1);
            totalAmount += sellingPrice * qty;

            itemCreates.push({
                productId: item.productId || item.id,
                variantId: item.variantId || null,
                quantity: new Prisma.Decimal(qty),
                sellingPrice: new Prisma.Decimal(sellingPrice),
                locationId: locationId || undefined
            });
        }

        const orderId = generateOrderId();
        const order = await prisma.order.create({
            data: {
                id: orderId,
                userId: finalUserId,
                locationId: locationId || undefined,
                packerId: userId,
                packedAt: new Date(),
                packerNotes: packerNotes || notes || null,
                packerPhoto: packerPhoto || null,
                totalAmount: new Prisma.Decimal(totalAmount),
                status: "PACKED" as PrismaOrderStatus,
                paymentStatus: "PENDING",
                channel: Channel.WHATSAPP,
                isDelivery: isDelivery !== false,
                shippingAddress: typeof customerAddress === "object" ? customerAddress : {
                    fullAddress: customerAddress || "WhatsApp Order Address",
                    name: customerName,
                    phone: customerPhone
                },
                notes: notes || "Created by Packer via WhatsApp flow",
                items: {
                    create: itemCreates
                },
                statusHistory: {
                    create: {
                        status: "PACKED" as PrismaOrderStatus,
                        remark: `WhatsApp order manually packed and created by Packer`,
                        changedBy: userId
                    }
                }
            },
            include: {
                user: { select: { id: true, name: true, phone: true, profileAddress: true } },
                items: { include: { product: true, variant: true } },
                location: true,
                packer: { select: { id: true, name: true } }
            }
        });

        // Notify POS of new packed order ready for billing
        getIo().emit("ORDER_PACKED_FOR_BILLING", { orderId: order.id, order });

        res.status(201).json({
            success: true,
            message: "Order packed and registered successfully",
            order
        });
    } catch (error: any) {
        logger.error("[createPackerOrder] Failed to create packer order:", error);
        res.status(500).json({ message: error.message || "Failed to create packed order" });
    }
};

// ─── Packer QR Bill Validation ────────────────────────────────────────────────
export const validatePackerQr = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { qrData, billId } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const targetId = extractBillId(billId || qrData);

    if (!targetId) {
        return res.status(400).json({ message: "Invalid QR code or bill ID" });
    }

    try {
        const order = await prisma.order.findFirst({
            where: {
                OR: [
                    { id: targetId },
                    { id: { endsWith: targetId } }
                ]
            },
            include: {
                user: { select: { id: true, name: true, phone: true } },
                items: { include: { product: true, variant: true } },
                packer: { select: { id: true, name: true } }
            }
        });

        if (!order) {
            return res.status(404).json({ message: `Order #${targetId} not found. Please verify the bill.` });
        }

        // Verify that logged-in packer is the packer attached to the order/bill
        if (order.packerId && order.packerId !== userId) {
            return res.status(400).json({
                success: false,
                message: "This bill was not packed by you. Please verify the order.",
                assignedPacker: order.packer?.name || "Another Packer"
            });
        }

        const updated = await prisma.order.update({
            where: { id: order.id },
            data: {
                packerId: userId, // Ensure packer is confirmed
                packerValidatedAt: new Date(),
                packerValidatedBy: userId,
                statusHistory: {
                    create: {
                        status: order.status,
                        remark: `Bill QR validated by Packer`,
                        changedBy: userId
                    }
                }
            },
            include: {
                user: { select: { id: true, name: true, phone: true } },
                items: { include: { product: true, variant: true } },
                location: true,
                packer: { select: { id: true, name: true } }
            }
        });

        res.json({
            success: true,
            message: "Bill Validated Successfully",
            order: updated
        });
    } catch (error: any) {
        logger.error("[validatePackerQr] Error:", error);
        res.status(500).json({ message: "Failed to validate bill QR" });
    }
};

// ─── Delivery Driver QR Claim ─────────────────────────────────────────────────
export const claimDeliveryQr = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { qrData, billId } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const targetId = extractBillId(billId || qrData);

    if (!targetId) {
        return res.status(400).json({ message: "Invalid QR code or bill ID" });
    }

    try {
        const order = await prisma.order.findFirst({
            where: {
                OR: [
                    { id: targetId },
                    { id: { endsWith: targetId } }
                ]
            },
            include: {
                user: { select: { id: true, name: true, phone: true, addresses: true, profileAddress: true } },
                items: { include: { product: true, variant: true } },
                location: true,
                packer: { select: { id: true, name: true } },
                deliveryPartner: { select: { id: true, name: true } },
                payments: true
            }
        });

        if (!order) {
            return res.status(404).json({ message: `Order #${targetId} not found.` });
        }

        // If already assigned to this driver, return it smoothly
        if (order.deliveryPartnerId === userId) {
            return res.json({
                success: true,
                message: "Order is already in your active delivery run.",
                order
            });
        }

        // Assign to this driver and mark as out for delivery
        const updated = await prisma.order.update({
            where: { id: order.id },
            data: {
                isDelivery: true,
                packerValidatedAt: order.packerValidatedAt || new Date(),
                deliveryPartnerId: userId,
                status: (order.status === "DELIVERED") ? order.status : ("OUT_FOR_DELIVERY" as PrismaOrderStatus),
                statusHistory: {
                    create: {
                        status: (order.status === "DELIVERED") ? order.status : ("OUT_FOR_DELIVERY" as PrismaOrderStatus),
                        remark: `Order claimed via QR scan by Delivery Partner`,
                        changedBy: userId
                    }
                }
            },
            include: {
                user: { select: { id: true, name: true, phone: true, addresses: true, profileAddress: true } },
                items: { include: { product: true, variant: true } },
                location: true,
                packer: { select: { id: true, name: true } },
                deliveryPartner: { select: { id: true, name: true } },
                payments: true
            }
        });

        res.json({
            success: true,
            message: "Order added to My Orders successfully",
            order: updated
        });
    } catch (error: any) {
        logger.error("[claimDeliveryQr] Error:", error);
        res.status(500).json({ message: "Failed to claim delivery order" });
    }
};

export const getCustomerOutstandingDues = async (req: AuthenticatedRequest, res: Response) => {
    const customerId = String(req.params.customerId || req.params.id || "");

    if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required" });
    }

    try {
        const customer = await prisma.user.findUnique({
            where: { id: customerId },
            select: { id: true, name: true, phone: true, profileAddress: true, totalDue: true }
        });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        const pendingOrders = await prisma.order.findMany({
            where: {
                userId: customerId,
                paymentStatus: { in: ["PENDING", "PARTIAL"] },
                status: { notIn: ["CANCELLED", "FAILED"] }
            },
            include: {
                payments: true,
                items: { include: { product: true } },
                location: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: "asc" }
        });

        let totalOutstandingDue = 0;
        const bills = pendingOrders.map((order: any) => {
            const paid = order.payments
                .filter((p: any) => p.status === "SUCCESS")
                .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
            const due = Math.max(0, Number(order.totalAmount) - paid);
            totalOutstandingDue += due;
            return {
                id: order.id,
                createdAt: order.createdAt,
                totalAmount: Number(order.totalAmount),
                paidAmount: paid,
                dueAmount: due,
                paymentStatus: order.paymentStatus,
                status: order.status,
                storeName: order.location?.name || "Main Hub",
                itemCount: order.items?.length || 0
            };
        });

        res.json({
            customer,
            bills,
            totalOutstandingDue: Number(totalOutstandingDue.toFixed(2))
        });
    } catch (error: any) {
        logger.error("[getCustomerOutstandingDues] Error:", error);
        res.status(500).json({ message: "Failed to fetch customer dues" });
    }
};

// ─── Cash Collection OTP (Send & Verify) ──────────────────────────────────────
export const sendCashCollectionOtp = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { orderId, customerId, amount } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ message: "Valid collection amount is required" });
    }

    try {
        let phone = "";
        let customerName = "Customer";

        if (orderId) {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { user: true }
            });
            if (order?.user?.phone) {
                phone = order.user.phone;
                customerName = order.user.name || "Customer";
            }
        }

        if (!phone && customerId) {
            const customer = await prisma.user.findUnique({ where: { id: customerId } });
            if (customer?.phone) {
                phone = customer.phone;
                customerName = customer.name || "Customer";
            }
        }

        if (!phone) {
            return res.status(404).json({ message: "Customer contact number not found" });
        }

        const otp = generateOtp();
        const otpKey = `CASH_OTP_${orderId || customerId}`;
        await storeOtp(otpKey, otp);

        const cleanPhone = phone.replace(/\D/g, "");
        const maskedPhone = cleanPhone.slice(-4).padStart(cleanPhone.length, "*");

        try {
            await sendOtpViaWhatsapp(cleanPhone, otp);
        } catch (msgErr) {
            logger.warn(`[sendCashCollectionOtp] WhatsApp delivery failed, using fallback OTP:`, msgErr);
        }

        res.json({
            success: true,
            message: `OTP sent to customer (${maskedPhone}) for cash collection of ₹${Number(amount).toFixed(2)}`,
            phone: maskedPhone,
            fallbackOtp: process.env.NODE_ENV !== "production" ? otp : undefined
        });
    } catch (error: any) {
        logger.error("[sendCashCollectionOtp] Error:", error);
        res.status(500).json({ message: "Failed to send cash collection OTP" });
    }
};

export const verifyCashCollectionOtp = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { orderId, customerId, amount, otp, clearAllDues } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!otp) return res.status(400).json({ message: "OTP is required" });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Valid collection amount is required" });

    const targetAmount = Number(amount);
    const otpKey = `CASH_OTP_${orderId || customerId}`;

    try {
        const isValid = await verifyOtp(otpKey, otp);
        if (!isValid) {
            return res.status(400).json({ message: "Invalid or expired OTP. Please ask customer for the correct code." });
        }

        // Process Cash Collection
        await prisma.$transaction(async (tx: any) => {
            if (clearAllDues && customerId) {
                // Distribute cash across all unpaid bills (oldest first)
                const pendingOrders = await tx.order.findMany({
                    where: {
                        userId: customerId,
                        paymentStatus: { in: ["PENDING", "PARTIAL"] },
                        status: { notIn: ["CANCELLED", "FAILED"] }
                    },
                    include: { payments: true },
                    orderBy: { createdAt: "asc" }
                });

                let remainingCollection = targetAmount;
                for (const ord of pendingOrders) {
                    if (remainingCollection <= 0) break;
                    const paid = ord.payments
                        .filter((p: any) => p.status === "SUCCESS")
                        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                    const billDue = Math.max(0, Number(ord.totalAmount) - paid);
                    const allocate = Math.min(remainingCollection, billDue);

                    if (allocate > 0) {
                        await tx.payment.create({
                            data: {
                                orderId: ord.id,
                                amount: new Prisma.Decimal(allocate),
                                method: "CASH",
                                status: "SUCCESS",
                                transactionId: `CASH_${Date.now()}_${ord.id.slice(-4)}`,
                                metadata: {
                                    collectedBy: userId,
                                    collectorRole: req.user?.role,
                                    otpVerified: true,
                                    timestamp: new Date().toISOString()
                                }
                            }
                        });

                        const newPaid = paid + allocate;
                        const isPaid = newPaid >= Number(ord.totalAmount);

                        await tx.order.update({
                            where: { id: ord.id },
                            data: {
                                isPaid,
                                paymentStatus: isPaid ? "COMPLETED" : "PARTIAL",
                                cashCollected: { increment: new Prisma.Decimal(allocate) },
                                statusHistory: {
                                    create: {
                                        status: ord.status,
                                        remark: `Cash collected ₹${allocate.toFixed(2)} (OTP Verified)`,
                                        changedBy: userId
                                    }
                                }
                            }
                        });

                        remainingCollection -= allocate;
                    }
                }
            } else if (orderId) {
                // Single order cash collection
                const ord = await tx.order.findUnique({
                    where: { id: orderId },
                    include: { payments: true }
                });
                if (!ord) throw new Error("Order not found");

                const paid = ord.payments
                    .filter((p: any) => p.status === "SUCCESS")
                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                const newPaid = paid + targetAmount;
                const isPaid = newPaid >= Number(ord.totalAmount);

                await tx.payment.create({
                    data: {
                        orderId: ord.id,
                        amount: new Prisma.Decimal(targetAmount),
                        method: "CASH",
                        status: "SUCCESS",
                        transactionId: `CASH_${Date.now()}_${ord.id.slice(-4)}`,
                        metadata: {
                            collectedBy: userId,
                            collectorRole: req.user?.role,
                            otpVerified: true,
                            timestamp: new Date().toISOString()
                        }
                    }
                });

                await tx.order.update({
                    where: { id: ord.id },
                    data: {
                        isPaid,
                        paymentStatus: isPaid ? "COMPLETED" : "PARTIAL",
                        cashCollected: { increment: new Prisma.Decimal(targetAmount) },
                        statusHistory: {
                            create: {
                                status: ord.status,
                                remark: `Cash collected ₹${targetAmount.toFixed(2)} (OTP Verified)`,
                                changedBy: userId
                            }
                        }
                    }
                });
            }
        });

        res.json({
            success: true,
            message: `Cash collection of ₹${targetAmount.toFixed(2)} verified and recorded successfully`
        });
    } catch (error: any) {
        logger.error("[verifyCashCollectionOtp] Error:", error);
        res.status(500).json({ message: error.message || "Failed to verify cash collection" });
    }
};

// ─── Mark Delivery Completed ──────────────────────────────────────────────────
export const markOrderDelivered = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const id = String(req.params.id);
    const { deliveryPhoto, notes } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { payments: true }
        });
        if (!order) return res.status(404).json({ message: "Order not found" });

        const updated = await prisma.order.update({
            where: { id },
            data: {
                status: "DELIVERED" as PrismaOrderStatus,
                deliveredAt: new Date(),
                deliveryPhoto: deliveryPhoto || order.deliveryPhoto,
                statusHistory: {
                    create: {
                        status: "DELIVERED" as PrismaOrderStatus,
                        remark: `Order marked as DELIVERED by Delivery Partner. ${notes ? notes : ''}`,
                        changedBy: userId
                    }
                }
            },
            include: {
                user: { select: { id: true, name: true, phone: true } },
                location: true,
                payments: true
            }
        });

        res.json({
            success: true,
            message: "Order successfully marked as DELIVERED",
            order: updated
        });
    } catch (error: any) {
        logger.error("[markOrderDelivered] Error:", error);
        res.status(500).json({ message: "Failed to mark order as delivered" });
    }
};

// ─── Driver Returns & Notifications ──────────────────────────────────────────
export const getDriverReturns = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const returns = await prisma.order.findMany({
            where: {
                OR: [
                    { returnAssignedTo: userId },
                    { deliveryPartnerId: userId, status: "RETURNED" },
                    { deliveryPartnerId: userId, returnStatus: { not: null } }
                ]
            },
            include: {
                user: { select: { id: true, name: true, phone: true, addresses: true, profileAddress: true } },
                items: { include: { product: true } },
                location: true
            },
            orderBy: { updatedAt: "desc" }
        });

        res.json({ returns });
    } catch (error: any) {
        res.status(500).json({ message: "Failed to fetch driver return tasks" });
    }
};

// ─── Enhanced Assigned Orders for Driver ──────────────────────────────────────
export const getAssignedOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const cursor = req.query.cursor ? (req.query.cursor as string) : undefined;

        const orders = await prisma.order.findMany({
            where: { deliveryPartnerId: userId },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                user: { select: { id: true, name: true, phone: true, email: true, addresses: true, profileAddress: true } },
                items: { include: { product: true, variant: true } },
                location: { select: { id: true, name: true, address: true, contactNumber: true, upiId: true } },
                packer: { select: { id: true, name: true, phone: true } },
                payments: true
            },
            orderBy: { createdAt: "desc" },
        });

        const hasMore = orders.length > limit;
        const data = hasMore ? orders.slice(0, limit) : orders;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        res.json({ data, nextCursor });
    } catch (error) {
        res.status(500).json({ message: "Error fetching assigned orders" });
    }
};


