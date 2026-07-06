import { Response, NextFunction } from "express";
import { OrderStatus as PrismaOrderStatus } from "@prisma/client";
import prisma from "../../config/prisma";
import { orderService } from "../../services/orderService";
import { logAuthorizationFailure, logDataHarvest } from "../../middleware/integrationThreatDetector";

export const getOrders = async (req: any, res: Response) => {
    const integration = req.integration;
    const { limit = 20, cursor, status } = req.query;

    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const where: any = {};

    if (status) {
        where.status = status as PrismaOrderStatus;
    }

    // Store isolation
    if (integration.role === "STORE_ADMIN") {
        if (integration.locationId) {
            where.locationId = integration.locationId;
        } else {
            return res.json({ data: [], nextCursor: null });
        }
    }

    try {
        const orders = await prisma.order.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor as string } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                items: { include: { product: { select: { id: true, name: true, sku: true } } } },
                user: { select: { id: true, name: true, phone: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const hasMore = orders.length > parsedLimit;
        const data = hasMore ? orders.slice(0, parsedLimit) : orders;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        // Log record consumption volume
        await logDataHarvest(req, data.length);

        res.json({ data, nextCursor });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getOrderById = async (req: any, res: Response) => {
    const { id } = req.params;
    const integration = req.integration;

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: { include: { product: { select: { id: true, name: true, sku: true } } } },
                statusHistory: { orderBy: { createdAt: "asc" } },
                payments: true,
                user: { select: { id: true, name: true, phone: true } }
            }
        });

        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        // Store boundary enforcement
        if (integration.role === "STORE_ADMIN" && order.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Order store boundary mismatch." });
        }

        res.json(order);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createOrder = async (req: any, res: Response, next: NextFunction) => {
    const integration = req.integration;
    const { userId, address, items, totalAmount, deliverySlot, deliveryDate, couponCode, taxAmount, notes, locationId, paymentMetadata } = req.body;

    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "UserId and items (non-empty array) are required." });
    }

    try {
        // Enforce user existence and store-level API key checks
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, locationId: true }
        });

        if (!user) {
            return res.status(404).json({ message: "Target customer user not found." });
        }

        let targetLocationId = locationId;

        if (integration.role === "STORE_ADMIN") {
            // Verify customer and request align with this API key's store location
            if (user.locationId && user.locationId !== integration.locationId) {
                await logAuthorizationFailure(req);
                return res.status(403).json({ message: "Forbidden. Customer user belongs to another store." });
            }
            if (locationId && locationId !== integration.locationId) {
                await logAuthorizationFailure(req);
                return res.status(403).json({ message: "Forbidden. Cannot place order at another store location." });
            }
            targetLocationId = integration.locationId;
        }

        // Place order using orderService for inventory reservations and transactional guarantees
        const order = await orderService.placeOrder({
            userId,
            address,
            items,
            totalAmount: parseFloat(totalAmount),
            deliverySlot,
            deliveryDate,
            couponCode,
            taxAmount: taxAmount ? parseFloat(taxAmount) : 0,
            notes,
            locationId: targetLocationId,
            paymentMetadata
        });

        res.status(201).json(order);
    } catch (error: any) {
        next(error);
    }
};

export const updateOrderStatus = async (req: any, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, remark, deliveryPartnerId } = req.body;
    const integration = req.integration;

    if (!status) {
        return res.status(400).json({ message: "Status is required." });
    }

    try {
        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        // Store boundary check
        if (integration.role === "STORE_ADMIN" && order.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Order store boundary mismatch." });
        }

        const updated = await prisma.order.update({
            where: { id },
            data: {
                status: status as PrismaOrderStatus,
                ...(deliveryPartnerId && { deliveryPartnerId }),
                statusHistory: {
                    create: {
                        status: status as PrismaOrderStatus,
                        remark: remark || `Integration API Key "${integration.name}" updated status to ${status}`,
                        changedBy: `API_KEY_${integration.id}`
                    }
                }
            }
        });

        // Audit Log entry
        await prisma.securityAuditLog.create({
            data: {
                tableName: "Order",
                attemptedOperation: `STATUS_UPDATE_${status}`,
                attemptedBy: `API_KEY_${integration.id}`,
                severity: "INFO",
                rawQuerySnippet: `Order status updated programmatically via Integration API.`
            }
        });

        res.json(updated);
    } catch (error: any) {
        next(error);
    }
};

export const cancelOrder = async (req: any, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { remark } = req.body;
    const integration = req.integration;

    try {
        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        // Store boundary check
        if (integration.role === "STORE_ADMIN" && order.locationId !== integration.locationId) {
            await logAuthorizationFailure(req);
            return res.status(403).json({ message: "Forbidden. Order store boundary mismatch." });
        }

        // Use core orderService to safely cancel and restore stocks
        await orderService.cancelOrder(
            id,
            `API_KEY_${integration.id}`,
            integration.role === "ADMIN",
            remark || "Cancelled programmatically via integration API."
        );

        res.json({ message: "Order cancelled and inventory restored successfully." });
    } catch (error: any) {
        next(error);
    }
};
