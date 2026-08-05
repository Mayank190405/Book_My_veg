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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssignedOrders = exports.sendDeliveryOtp = exports.updateOrderPaymentStatus = exports.updatePackingDetails = exports.getPackedOrdersCount = exports.getOrdersForPacking = exports.updateOrderStatus = exports.getAllOrders = exports.cancelOrder = exports.getOrderById = exports.getOrders = exports.createOrder = exports.assignDriver = exports.assignPacker = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const autoCancelQueue_1 = require("../queues/autoCancelQueue");
const orderService_1 = require("../services/orderService");
const io_1 = require("../sockets/io");
// ─── Assigning Operations ─────────────────────────────────────────────────────
const assignPacker = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { packerId } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const order = yield prisma_1.default.order.update({
            where: { id: id },
            data: {
                packer: packerId ? { connect: { id: packerId } } : undefined,
                status: "PROCESSING",
                statusHistory: {
                    create: {
                        status: "PROCESSING",
                        remark: "Assigned to Packer",
                        changedBy: userId
                    }
                }
            }
        });
        // 🔔 Specific Bell for the Packer
        (0, io_1.getIo)().to(packerId).emit("OP_NEW_ORDER", {
            id: order.id,
            status: "PROCESSING",
            type: "PACKING"
        });
        res.json({ message: "Packer assigned successfully", order });
    }
    catch (error) {
        next(error);
    }
});
exports.assignPacker = assignPacker;
const assignDriver = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { driverId } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const order = yield prisma_1.default.order.update({
            where: { id: id },
            data: {
                deliveryPartner: driverId ? { connect: { id: driverId } } : undefined,
                status: "SHIPPED",
                statusHistory: {
                    create: {
                        status: "SHIPPED",
                        remark: "Assigned to Delivery Partner",
                        changedBy: userId
                    }
                }
            }
        });
        // 🔔 Specific Bell for the Driver
        (0, io_1.getIo)().to(driverId).emit("OP_NEW_ORDER", {
            id: order.id,
            status: "SHIPPED",
            type: "DELIVERY"
        });
        res.json({ message: "Driver assigned successfully", order });
    }
    catch (error) {
        next(error);
    }
});
exports.assignDriver = assignDriver;
// ─── place order ─────────────────────────────────────────────────────────────
const createOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const _b = req.body, { paymentMetadata } = _b, orderParams = __rest(_b, ["paymentMetadata"]);
        const order = yield orderService_1.orderService.placeOrder(Object.assign({ userId,
            paymentMetadata }, orderParams));
        // Schedule auto-cancel
        yield (0, autoCancelQueue_1.scheduleOrderAutoCancel)(order.id);
        logger_1.default.info("Order created", { orderId: order.id, userId });
        res.status(201).json(order);
    }
    catch (error) {
        next(error);
    }
});
exports.createOrder = createOrder;
// ─── get user orders (cursor-based) ─────────────────────────────────────────
const getOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    // ── FIX 2: Cursor pagination ───────────────────────────────────────────
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    try {
        const orders = yield prisma_1.default.order.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching orders" });
    }
});
exports.getOrders = getOrders;
// ─── get single order ────────────────────────────────────────────────────────
const getOrderById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const id = req.params.id;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const order = yield prisma_1.default.order.findFirst({
            where: { id, userId },
            include: {
                items: { include: { product: true } },
                statusHistory: { orderBy: { createdAt: "asc" } },
                payments: true,
                deliveryPartner: { select: { name: true, phone: true } },
                location: true,
            },
        });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching order detail" });
    }
});
exports.getOrderById = getOrderById;
// ─── cancel order ─────────────────────────────────────────────────────────────
const cancelOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const id = req.params.id;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const isAdmin = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "ADMIN";
    const remark = req.body.remark || (isAdmin ? "Cancelled by admin" : "Cancelled by user");
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        yield orderService_1.orderService.cancelOrder(id, userId, isAdmin, remark);
        res.json({ message: "Order cancelled successfully" });
    }
    catch (error) {
        next(error);
    }
});
exports.cancelOrder = cancelOrder;
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Basic pagination
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = req.query.cursor ? req.query.cursor : undefined;
    try {
        const orders = yield prisma_1.default.order.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching all orders" });
    }
});
exports.getAllOrders = getAllOrders;
const otp_1 = require("../utils/otp");
const mbgcard_1 = require("../services/mbgcard");
const updateOrderStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { id } = req.params;
    const { status, remark, deliveryPartnerId, deliveryPhoto, deliveryOtp } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const order = yield prisma_1.default.order.findUnique({ where: { id: id } });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        // Logic for delivery verification if user is a driver
        if (status === "DELIVERED" && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "DELIVERY_PARTNER") {
            if (!deliveryOtp) {
                return res.status(400).json({ message: "Delivery OTP is required to complete delivery" });
            }
            const isOtpValid = yield (0, otp_1.verifyOtp)(`DELIVERY_${id}`, deliveryOtp);
            if (!isOtpValid) {
                return res.status(400).json({ message: "Invalid or expired Delivery OTP" });
            }
        }
        const updated = yield prisma_1.default.order.update({
            where: { id: id },
            data: Object.assign(Object.assign(Object.assign({ status: status }, (deliveryPartnerId && { deliveryPartnerId })), (deliveryPhoto && { deliveryPhoto })), { statusHistory: {
                    create: {
                        status: status,
                        remark: remark || `Status updated to ${status}${deliveryPartnerId ? ' (Driver Assigned)' : ''}${deliveryOtp ? ' (OTP Verified)' : ''}${deliveryPhoto ? ' (Photo Attached)' : ''}`,
                        changedBy: userId
                    }
                } })
        });
        // Automatically complete COD payment and mark order paid when status is DELIVERED
        if (status === "DELIVERED") {
            const pendingCodPayment = yield prisma_1.default.payment.findFirst({
                where: { orderId: id, method: "COD", status: "PENDING" }
            });
            if (pendingCodPayment) {
                yield prisma_1.default.$transaction([
                    prisma_1.default.payment.update({
                        where: { id: pendingCodPayment.id },
                        data: { status: "SUCCESS", transactionId: `DELIVERED_${Date.now()}` }
                    }),
                    prisma_1.default.order.update({
                        where: { id: id },
                        data: { isPaid: true, paymentStatus: "COMPLETED" }
                    })
                ]);
            }
            else {
                yield prisma_1.default.order.update({
                    where: { id: id },
                    data: { isPaid: true, paymentStatus: "COMPLETED" }
                });
            }
            // Trigger feedback request WhatsApp notification!
            try {
                const user = yield prisma_1.default.user.findUnique({ where: { id: order.userId }, select: { name: true, phone: true } });
                if (user === null || user === void 0 ? void 0 : user.phone) {
                    const { sendFeedbackRequestViaWhatsapp } = require("../services/mbgcard");
                    sendFeedbackRequestViaWhatsapp(user.phone, user.name || "Customer", id).catch((err) => {
                        console.error("[OrderController] WhatsApp feedback dispatch failure:", err);
                    });
                }
            }
            catch (err) {
                console.error("[OrderController] Failed to send WhatsApp feedback:", err);
            }
        }
        // Create Audit Log
        yield prisma_1.default.auditLog.create({
            data: {
                entityType: "ORDER",
                entityId: id,
                action: `STATUS_UPDATE_${status}`,
                staffId: (userId === null || userId === void 0 ? void 0 : userId.startsWith("STORE_")) ? null : userId,
                locationId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.locationId,
                newValue: { status, remark }
            }
        });
        // Trigger status update WhatsApp notification!
        try {
            const user = yield prisma_1.default.user.findUnique({ where: { id: order.userId }, select: { name: true, phone: true } });
            if (user === null || user === void 0 ? void 0 : user.phone) {
                const { sendOrderStatusUpdateViaWhatsapp } = require("../services/mbgcard");
                sendOrderStatusUpdateViaWhatsapp(user.phone, user.name || "Customer", id, status).catch((err) => {
                    console.error("[OrderController] WhatsApp status update dispatch failure:", err);
                });
            }
        }
        catch (err) {
            console.error("[OrderController] Failed to send WhatsApp status update:", err);
        }
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
exports.updateOrderStatus = updateOrderStatus;
const getOrdersForPacking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const orders = yield prisma_1.default.order.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching packing assignments" });
    }
});
exports.getOrdersForPacking = getOrdersForPacking;
const getPackedOrdersCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const count = yield prisma_1.default.order.count({
            where: { packerId: userId }
        });
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching packed orders count" });
    }
});
exports.getPackedOrdersCount = getPackedOrdersCount;
const updatePackingDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const { packerPhoto, packerNotes, status } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const updated = yield prisma_1.default.order.update({
            where: { id: id },
            data: {
                status: (status || "PACKED"),
                packerId: userId,
                packedAt: new Date(),
                packerPhoto: packerPhoto || null,
                packerNotes: packerNotes || null,
                statusHistory: {
                    create: {
                        status: (status || "PACKED"),
                        remark: `Order marked as packed by packer. ${packerNotes ? 'Notes: ' + packerNotes : ''}`,
                        changedBy: userId
                    }
                }
            }
        });
        // Create Audit Log
        yield prisma_1.default.auditLog.create({
            data: {
                entityType: "ORDER",
                entityId: id,
                action: "ORDER_PACKED",
                staffId: (userId === null || userId === void 0 ? void 0 : userId.startsWith("STORE_")) ? null : userId,
                locationId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId,
                newValue: { status: status || "PACKED", notes: packerNotes }
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ message: "Error updating packing details" });
    }
});
exports.updatePackingDetails = updatePackingDetails;
const updateOrderPaymentStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const { isPaid } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const order = yield prisma_1.default.order.findUnique({ where: { id: id } });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const updated = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const upd = yield tx.order.update({
                where: { id: id },
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
                const pendingPayment = yield tx.payment.findFirst({
                    where: { orderId: id, status: "PENDING" }
                });
                if (pendingPayment) {
                    yield tx.payment.update({
                        where: { id: pendingPayment.id },
                        data: {
                            status: "SUCCESS",
                            method: order.channel === "POS" ? "CASH" : "COD"
                        }
                    });
                }
                else {
                    // Create new successful payment record
                    yield tx.payment.create({
                        data: {
                            orderId: id,
                            amount: order.totalAmount,
                            method: order.channel === "POS" ? "CASH" : "COD",
                            status: "SUCCESS",
                            transactionId: `MANUAL_${Date.now()}`
                        }
                    });
                }
            }
            else {
                // Mark successful payments back to PENDING
                yield tx.payment.updateMany({
                    where: { orderId: id, status: "SUCCESS" },
                    data: { status: "PENDING" }
                });
            }
            return upd;
        }));
        // Create Audit Log
        yield prisma_1.default.auditLog.create({
            data: {
                entityType: "ORDER",
                entityId: id,
                action: isPaid ? "PAYMENT_COLLECTED" : "PAYMENT_REVERSED",
                staffId: (userId === null || userId === void 0 ? void 0 : userId.startsWith("STORE_")) ? null : userId,
                locationId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId,
                newValue: { isPaid }
            }
        });
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
exports.updateOrderPaymentStatus = updateOrderPaymentStatus;
const sendDeliveryOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!order || !((_a = order.user) === null || _a === void 0 ? void 0 : _a.phone)) {
            return res.status(404).json({ message: "Order or customer phone not found" });
        }
        const otp = (0, otp_1.generateOtp)();
        yield (0, otp_1.storeOtp)(`DELIVERY_${id}`, otp);
        try {
            yield (0, mbgcard_1.sendOtpViaWhatsapp)(order.user.phone, otp);
            res.json({ message: "Delivery OTP sent via WhatsApp" });
        }
        catch (e) {
            console.error("WhatsApp delivery failed, fallback OTP used.", e);
            res.json({ message: "OTP provider failed, check logs or use default if in sandbox", fallbackOtp: process.env.NODE_ENV !== "production" ? otp : undefined });
        }
    }
    catch (error) {
        res.status(500).json({ message: "Failed to send delivery OTP" });
    }
});
exports.sendDeliveryOtp = sendDeliveryOtp;
const getAssignedOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const cursor = req.query.cursor ? req.query.cursor : undefined;
        const orders = yield prisma_1.default.order.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching assigned orders" });
    }
});
exports.getAssignedOrders = getAssignedOrders;
