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
exports.cancelOrder = exports.updateOrderStatus = exports.createOrder = exports.getOrderById = exports.getOrders = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const orderService_1 = require("../../services/orderService");
const integrationThreatDetector_1 = require("../../middleware/integrationThreatDetector");
const getOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    const { limit = 20, cursor, status } = req.query;
    const parsedLimit = Math.min(Number(limit) || 20, 100);
    const where = {};
    if (status) {
        where.status = status;
    }
    // Store isolation
    if (integration.role === "STORE_ADMIN") {
        if (integration.locationId) {
            where.locationId = integration.locationId;
        }
        else {
            return res.json({ data: [], nextCursor: null });
        }
    }
    try {
        const orders = yield prisma_1.default.order.findMany({
            where,
            take: parsedLimit + 1,
            cursor: cursor ? { id: cursor } : undefined,
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
        yield (0, integrationThreatDetector_1.logDataHarvest)(req, data.length);
        res.json({ data, nextCursor });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getOrders = getOrders;
const getOrderById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const integration = req.integration;
    try {
        const order = yield prisma_1.default.order.findUnique({
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
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Order store boundary mismatch." });
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getOrderById = getOrderById;
const createOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = req.integration;
    const { userId, address, items, totalAmount, deliverySlot, deliveryDate, couponCode, taxAmount, notes, locationId, paymentMetadata } = req.body;
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "UserId and items (non-empty array) are required." });
    }
    try {
        // Enforce user existence and store-level API key checks
        const user = yield prisma_1.default.user.findUnique({
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
                yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
                return res.status(403).json({ message: "Forbidden. Customer user belongs to another store." });
            }
            if (locationId && locationId !== integration.locationId) {
                yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
                return res.status(403).json({ message: "Forbidden. Cannot place order at another store location." });
            }
            targetLocationId = integration.locationId;
        }
        // Place order using orderService for inventory reservations and transactional guarantees
        const order = yield orderService_1.orderService.placeOrder({
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
    }
    catch (error) {
        next(error);
    }
});
exports.createOrder = createOrder;
const updateOrderStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status, remark, deliveryPartnerId } = req.body;
    const integration = req.integration;
    if (!status) {
        return res.status(400).json({ message: "Status is required." });
    }
    try {
        const order = yield prisma_1.default.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }
        // Store boundary check
        if (integration.role === "STORE_ADMIN" && order.locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Order store boundary mismatch." });
        }
        const updated = yield prisma_1.default.order.update({
            where: { id },
            data: Object.assign(Object.assign({ status: status }, (deliveryPartnerId && { deliveryPartnerId })), { statusHistory: {
                    create: {
                        status: status,
                        remark: remark || `Integration API Key "${integration.name}" updated status to ${status}`,
                        changedBy: `API_KEY_${integration.id}`
                    }
                } })
        });
        // Audit Log entry
        yield prisma_1.default.securityAuditLog.create({
            data: {
                tableName: "Order",
                attemptedOperation: `STATUS_UPDATE_${status}`,
                attemptedBy: `API_KEY_${integration.id}`,
                severity: "INFO",
                rawQuerySnippet: `Order status updated programmatically via Integration API.`
            }
        });
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
exports.updateOrderStatus = updateOrderStatus;
const cancelOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { remark } = req.body;
    const integration = req.integration;
    try {
        const order = yield prisma_1.default.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }
        // Store boundary check
        if (integration.role === "STORE_ADMIN" && order.locationId !== integration.locationId) {
            yield (0, integrationThreatDetector_1.logAuthorizationFailure)(req);
            return res.status(403).json({ message: "Forbidden. Order store boundary mismatch." });
        }
        // Use core orderService to safely cancel and restore stocks
        yield orderService_1.orderService.cancelOrder(id, `API_KEY_${integration.id}`, integration.role === "ADMIN", remark || "Cancelled programmatically via integration API.");
        res.json({ message: "Order cancelled and inventory restored successfully." });
    }
    catch (error) {
        next(error);
    }
});
exports.cancelOrder = cancelOrder;
