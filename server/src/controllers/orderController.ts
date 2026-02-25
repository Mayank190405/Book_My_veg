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

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string };
}

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
            },
        });

        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Error fetching order detail" });
    }
};

// ─── admin: get all orders (cursor-based) ────────────────────────────────────

export const getAllOrders = async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const channel = req.query.channel ? String(req.query.channel) : undefined;

    try {
        const orders = await prisma.order.findMany({
            where: {
                ...(status && { status: status as PrismaOrderStatus }),
                ...(channel && { channel: channel as any })
            },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                items: { include: { product: true } },
                user: { select: { name: true, phone: true } },
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

// ─── update order status (state machine guarded) ─────────────────────────────

export const updateOrderStatus = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status, remark, changedBy } = req.body;

    try {
        const existing = await prisma.order.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Order not found" });

        // ── FIX 4: State machine validation ───────────────────────────────
        try {
            assertValidTransition(existing.status as OrderStatus, status as OrderStatus);
        } catch (err) {
            if (err instanceof InvalidTransitionError) {
                return res.status(422).json({ message: (err as Error).message });
            }
            throw err;
        }

        const order = await prisma.$transaction(async (tx: any) => {
            const updated = await tx.order.update({
                where: { id },
                data: { status: status as PrismaOrderStatus },
                include: { items: true, user: true },
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: id,
                    status: status as PrismaOrderStatus,
                    remark: remark || `Status updated to ${status}`,
                    changedBy: changedBy || "SYSTEM",
                },
            });

            return updated;
        });

        if (order.userId) {
            io.to(order.userId).emit("order_status_updated", { orderId: order.id, status: order.status });
        }

        res.json(order);
    } catch (error) {
        logger.error("Error updating order status", error);
        res.status(500).json({ message: "Error updating order status" });
    }
};

// ─── cancel order ─────────────────────────────────────────────────────────────

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

export const processWebOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const { locationId } = req.body;
    const staffId = req.user?.userId;

    if (!staffId) return res.status(401).json({ message: "Unauthorized" });
    if (!locationId) return res.status(400).json({ message: "locationId is required" });

    try {
        const order = await orderService.processWebOrder(id, locationId, staffId);
        res.json(order);
    } catch (error) {
        next(error);
    }
};

// ─── Packer API ───────────────────────────────────────────────────────────────

export const getAssignedOrdersForPacker = async (req: AuthenticatedRequest, res: Response) => {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ message: "Location slug is required" });

    try {
        const orders = await prisma.order.findMany({
            where: {
                status: "CONFIRMED" // Orders ready for packing
            },
            include: {
                items: { include: { product: true } },
                user: { select: { name: true, phone: true } },
            },
            orderBy: { createdAt: "asc" }
        });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Error fetching assigned orders" });
    }
};

export const submitPackedOrder = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const { missingReasons, bagPhotoUrl } = req.body;
    const staffId = req.user?.userId;

    try {
        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) return res.status(404).json({ message: "Order not found" });

        const remarkParts = [];
        if (bagPhotoUrl) remarkParts.push(`Bag Photo: ${bagPhotoUrl}`);
        if (missingReasons && Object.keys(missingReasons).length > 0) {
            remarkParts.push(`Missing Items: ${JSON.stringify(missingReasons)}`);
        }
        const remark = remarkParts.length > 0 ? remarkParts.join(" | ") : "Order packed";

        const updated = await prisma.$transaction(async (tx: any) => {
            const up = await tx.order.update({
                where: { id },
                data: { status: "PACKED" as PrismaOrderStatus }
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: id,
                    status: "PACKED" as PrismaOrderStatus,
                    remark,
                    changedBy: staffId || "PACKER",
                },
            });

            return up;
        });

        if (updated.userId) {
            io.to(updated.userId).emit("order_status_updated", { orderId: updated.id, status: updated.status });
        }

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: "Error packing order" });
    }
};
