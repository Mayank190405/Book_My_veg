import { Request, Response, NextFunction } from "express";
import { OrderStatus as PrismaOrderStatus } from "@prisma/client";
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

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string; locationId?: string };
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

import { generateOtp, storeOtp, verifyOtp } from "../utils/otp";
import { sendOtpViaWhatsapp } from "../services/mbgcard";

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

export const getAssignedOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const cursor = req.query.cursor ? (req.query.cursor as string) : undefined;

        const orders = await prisma.order.findMany({
            where: { deliveryPartnerId: userId },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                user: { select: { name: true, phone: true } },
                items: { include: { product: true } },
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

