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
exports.getAssignedOrders = exports.getDriverReturns = exports.markOrderDelivered = exports.verifyCashCollectionOtp = exports.sendCashCollectionOtp = exports.getCustomerOutstandingDues = exports.claimDeliveryQr = exports.validatePackerQr = exports.createPackerOrder = exports.extractBillId = exports.sendDeliveryOtp = exports.updateOrderPaymentStatus = exports.updatePackingDetails = exports.getPackedOrdersCount = exports.getOrdersForPacking = exports.updateOrderStatus = exports.getAllOrders = exports.cancelOrder = exports.getOrderById = exports.getOrders = exports.createOrder = exports.assignDriver = exports.assignPacker = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const autoCancelQueue_1 = require("../queues/autoCancelQueue");
const orderService_1 = require("../services/orderService");
const io_1 = require("../sockets/io");
const otp_1 = require("../utils/otp");
const mbgcard_1 = require("../services/mbgcard");
const idGenerator_1 = require("../utils/idGenerator");
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
const extractBillId = (qrData) => {
    if (!qrData)
        return "";
    let str = String(qrData).trim();
    if (str.includes("billid=")) {
        const match = str.match(/billid=([^&]+)/);
        if (match)
            return decodeURIComponent(match[1]).trim();
    }
    if (str.includes("/invoice/")) {
        const parts = str.split("/invoice/");
        if (parts[1])
            return parts[1].split("?")[0].split("/")[0].trim();
    }
    if (str.includes("/pay/")) {
        const afterPay = str.split("/pay/")[1];
        if (afterPay) {
            const match = afterPay.match(/billid=([^&]+)/);
            if (match)
                return decodeURIComponent(match[1]).trim();
        }
    }
    return str;
};
exports.extractBillId = extractBillId;
// ─── Packer Manual Order Creation (e.g. WhatsApp orders) ─────────────────────
const createPackerOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    const { customerId, customerName, customerPhone, customerAddress, items, notes, packerNotes, packerPhoto, isDelivery = true } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
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
            let user = yield prisma_1.default.user.findFirst({
                where: { OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
            if (!user) {
                user = yield prisma_1.default.user.create({
                    data: {
                        phone: cleanPhone,
                        name: customerName || "WhatsApp Customer",
                        profileAddress: customerAddress || null
                    }
                });
                if (customerAddress) {
                    yield prisma_1.default.address.create({
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
                const prod = yield prisma_1.default.product.findUnique({
                    where: { id: item.productId || item.id },
                    include: { variants: true }
                });
                if (prod) {
                    sellingPrice = Number(prod.basePrice || 0);
                    if (item.variantId) {
                        const variant = prod.variants.find((v) => v.id === item.variantId);
                        if (variant)
                            sellingPrice = Number(variant.price);
                    }
                }
            }
            const qty = Number(item.quantity || 1);
            totalAmount += sellingPrice * qty;
            itemCreates.push({
                productId: item.productId || item.id,
                variantId: item.variantId || null,
                quantity: new client_1.Prisma.Decimal(qty),
                sellingPrice: new client_1.Prisma.Decimal(sellingPrice),
                locationId: locationId || undefined
            });
        }
        const orderId = (0, idGenerator_1.generateOrderId)();
        const order = yield prisma_1.default.order.create({
            data: {
                id: orderId,
                userId: finalUserId,
                locationId: locationId || undefined,
                packerId: userId,
                packedAt: new Date(),
                packerNotes: packerNotes || notes || null,
                packerPhoto: packerPhoto || null,
                totalAmount: new client_1.Prisma.Decimal(totalAmount),
                status: "PACKED",
                paymentStatus: "PENDING",
                channel: client_1.Channel.WHATSAPP,
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
                        status: "PACKED",
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
        (0, io_1.getIo)().emit("ORDER_PACKED_FOR_BILLING", { orderId: order.id, order });
        res.status(201).json({
            success: true,
            message: "Order packed and registered successfully",
            order
        });
    }
    catch (error) {
        logger_1.default.error("[createPackerOrder] Failed to create packer order:", error);
        res.status(500).json({ message: error.message || "Failed to create packed order" });
    }
});
exports.createPackerOrder = createPackerOrder;
// ─── Packer QR Bill Validation ────────────────────────────────────────────────
const validatePackerQr = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { qrData, billId } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    const targetId = (0, exports.extractBillId)(billId || qrData);
    if (!targetId) {
        return res.status(400).json({ message: "Invalid QR code or bill ID" });
    }
    try {
        const order = yield prisma_1.default.order.findFirst({
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
                assignedPacker: ((_b = order.packer) === null || _b === void 0 ? void 0 : _b.name) || "Another Packer"
            });
        }
        const updated = yield prisma_1.default.order.update({
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
    }
    catch (error) {
        logger_1.default.error("[validatePackerQr] Error:", error);
        res.status(500).json({ message: "Failed to validate bill QR" });
    }
});
exports.validatePackerQr = validatePackerQr;
// ─── Delivery Driver QR Claim ─────────────────────────────────────────────────
const claimDeliveryQr = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { qrData, billId } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    const targetId = (0, exports.extractBillId)(billId || qrData);
    if (!targetId) {
        return res.status(400).json({ message: "Invalid QR code or bill ID" });
    }
    try {
        const order = yield prisma_1.default.order.findFirst({
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
        // Rule 1: Order must be marked for Delivery
        if (!order.isDelivery) {
            return res.status(400).json({
                success: false,
                message: "This order is not for delivery."
            });
        }
        // Rule 2: Packer validation must be completed
        if (!order.packerValidatedAt) {
            return res.status(400).json({
                success: false,
                message: "Bill has not been validated by the packer yet. Please ask the packer to scan and validate."
            });
        }
        // Rule 3: Must not be already assigned to another delivery person
        if (order.deliveryPartnerId && order.deliveryPartnerId !== userId) {
            return res.status(400).json({
                success: false,
                message: "This order is already assigned to another delivery person."
            });
        }
        // If already assigned to this driver, return it smoothly
        if (order.deliveryPartnerId === userId) {
            return res.json({
                success: true,
                message: "Order is already in your active delivery run.",
                order
            });
        }
        // Assign to this driver
        const updated = yield prisma_1.default.order.update({
            where: { id: order.id },
            data: {
                deliveryPartnerId: userId,
                status: (order.status === "CONFIRMED" || order.status === "PACKED" || order.status === "PROCESSING") ? "OUT_FOR_DELIVERY" : order.status,
                statusHistory: {
                    create: {
                        status: "OUT_FOR_DELIVERY",
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
    }
    catch (error) {
        logger_1.default.error("[claimDeliveryQr] Error:", error);
        res.status(500).json({ message: "Failed to claim delivery order" });
    }
});
exports.claimDeliveryQr = claimDeliveryQr;
const getCustomerOutstandingDues = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const customerId = String(req.params.customerId || req.params.id || "");
    if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required" });
    }
    try {
        const customer = yield prisma_1.default.user.findUnique({
            where: { id: customerId },
            select: { id: true, name: true, phone: true, profileAddress: true, totalDue: true }
        });
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
        const pendingOrders = yield prisma_1.default.order.findMany({
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
        const bills = pendingOrders.map((order) => {
            var _a, _b;
            const paid = order.payments
                .filter((p) => p.status === "SUCCESS")
                .reduce((sum, p) => sum + Number(p.amount), 0);
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
                storeName: ((_a = order.location) === null || _a === void 0 ? void 0 : _a.name) || "Main Hub",
                itemCount: ((_b = order.items) === null || _b === void 0 ? void 0 : _b.length) || 0
            };
        });
        res.json({
            customer,
            bills,
            totalOutstandingDue: Number(totalOutstandingDue.toFixed(2))
        });
    }
    catch (error) {
        logger_1.default.error("[getCustomerOutstandingDues] Error:", error);
        res.status(500).json({ message: "Failed to fetch customer dues" });
    }
});
exports.getCustomerOutstandingDues = getCustomerOutstandingDues;
// ─── Cash Collection OTP (Send & Verify) ──────────────────────────────────────
const sendCashCollectionOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { orderId, customerId, amount } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ message: "Valid collection amount is required" });
    }
    try {
        let phone = "";
        let customerName = "Customer";
        if (orderId) {
            const order = yield prisma_1.default.order.findUnique({
                where: { id: orderId },
                include: { user: true }
            });
            if ((_b = order === null || order === void 0 ? void 0 : order.user) === null || _b === void 0 ? void 0 : _b.phone) {
                phone = order.user.phone;
                customerName = order.user.name || "Customer";
            }
        }
        if (!phone && customerId) {
            const customer = yield prisma_1.default.user.findUnique({ where: { id: customerId } });
            if (customer === null || customer === void 0 ? void 0 : customer.phone) {
                phone = customer.phone;
                customerName = customer.name || "Customer";
            }
        }
        if (!phone) {
            return res.status(404).json({ message: "Customer contact number not found" });
        }
        const otp = (0, otp_1.generateOtp)();
        const otpKey = `CASH_OTP_${orderId || customerId}`;
        yield (0, otp_1.storeOtp)(otpKey, otp);
        const cleanPhone = phone.replace(/\D/g, "");
        const maskedPhone = cleanPhone.slice(-4).padStart(cleanPhone.length, "*");
        try {
            yield (0, mbgcard_1.sendOtpViaWhatsapp)(cleanPhone, otp);
        }
        catch (msgErr) {
            logger_1.default.warn(`[sendCashCollectionOtp] WhatsApp delivery failed, using fallback OTP:`, msgErr);
        }
        res.json({
            success: true,
            message: `OTP sent to customer (${maskedPhone}) for cash collection of ₹${Number(amount).toFixed(2)}`,
            phone: maskedPhone,
            fallbackOtp: process.env.NODE_ENV !== "production" ? otp : undefined
        });
    }
    catch (error) {
        logger_1.default.error("[sendCashCollectionOtp] Error:", error);
        res.status(500).json({ message: "Failed to send cash collection OTP" });
    }
});
exports.sendCashCollectionOtp = sendCashCollectionOtp;
const verifyCashCollectionOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { orderId, customerId, amount, otp, clearAllDues } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    if (!otp)
        return res.status(400).json({ message: "OTP is required" });
    if (!amount || Number(amount) <= 0)
        return res.status(400).json({ message: "Valid collection amount is required" });
    const targetAmount = Number(amount);
    const otpKey = `CASH_OTP_${orderId || customerId}`;
    try {
        const isValid = yield (0, otp_1.verifyOtp)(otpKey, otp);
        if (!isValid) {
            return res.status(400).json({ message: "Invalid or expired OTP. Please ask customer for the correct code." });
        }
        // Process Cash Collection
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            if (clearAllDues && customerId) {
                // Distribute cash across all unpaid bills (oldest first)
                const pendingOrders = yield tx.order.findMany({
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
                    if (remainingCollection <= 0)
                        break;
                    const paid = ord.payments
                        .filter((p) => p.status === "SUCCESS")
                        .reduce((sum, p) => sum + Number(p.amount), 0);
                    const billDue = Math.max(0, Number(ord.totalAmount) - paid);
                    const allocate = Math.min(remainingCollection, billDue);
                    if (allocate > 0) {
                        yield tx.payment.create({
                            data: {
                                orderId: ord.id,
                                amount: new client_1.Prisma.Decimal(allocate),
                                method: "CASH",
                                status: "SUCCESS",
                                transactionId: `CASH_${Date.now()}_${ord.id.slice(-4)}`,
                                metadata: {
                                    collectedBy: userId,
                                    collectorRole: (_a = req.user) === null || _a === void 0 ? void 0 : _a.role,
                                    otpVerified: true,
                                    timestamp: new Date().toISOString()
                                }
                            }
                        });
                        const newPaid = paid + allocate;
                        const isPaid = newPaid >= Number(ord.totalAmount);
                        yield tx.order.update({
                            where: { id: ord.id },
                            data: {
                                isPaid,
                                paymentStatus: isPaid ? "COMPLETED" : "PARTIAL",
                                cashCollected: { increment: new client_1.Prisma.Decimal(allocate) },
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
            }
            else if (orderId) {
                // Single order cash collection
                const ord = yield tx.order.findUnique({
                    where: { id: orderId },
                    include: { payments: true }
                });
                if (!ord)
                    throw new Error("Order not found");
                const paid = ord.payments
                    .filter((p) => p.status === "SUCCESS")
                    .reduce((sum, p) => sum + Number(p.amount), 0);
                const newPaid = paid + targetAmount;
                const isPaid = newPaid >= Number(ord.totalAmount);
                yield tx.payment.create({
                    data: {
                        orderId: ord.id,
                        amount: new client_1.Prisma.Decimal(targetAmount),
                        method: "CASH",
                        status: "SUCCESS",
                        transactionId: `CASH_${Date.now()}_${ord.id.slice(-4)}`,
                        metadata: {
                            collectedBy: userId,
                            collectorRole: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
                            otpVerified: true,
                            timestamp: new Date().toISOString()
                        }
                    }
                });
                yield tx.order.update({
                    where: { id: ord.id },
                    data: {
                        isPaid,
                        paymentStatus: isPaid ? "COMPLETED" : "PARTIAL",
                        cashCollected: { increment: new client_1.Prisma.Decimal(targetAmount) },
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
        }));
        res.json({
            success: true,
            message: `Cash collection of ₹${targetAmount.toFixed(2)} verified and recorded successfully`
        });
    }
    catch (error) {
        logger_1.default.error("[verifyCashCollectionOtp] Error:", error);
        res.status(500).json({ message: error.message || "Failed to verify cash collection" });
    }
});
exports.verifyCashCollectionOtp = verifyCashCollectionOtp;
// ─── Mark Delivery Completed ──────────────────────────────────────────────────
const markOrderDelivered = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const id = String(req.params.id);
    const { deliveryPhoto, notes } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id },
            include: { payments: true }
        });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        const updated = yield prisma_1.default.order.update({
            where: { id },
            data: {
                status: "DELIVERED",
                deliveredAt: new Date(),
                deliveryPhoto: deliveryPhoto || order.deliveryPhoto,
                statusHistory: {
                    create: {
                        status: "DELIVERED",
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
    }
    catch (error) {
        logger_1.default.error("[markOrderDelivered] Error:", error);
        res.status(500).json({ message: "Failed to mark order as delivered" });
    }
});
exports.markOrderDelivered = markOrderDelivered;
// ─── Driver Returns & Notifications ──────────────────────────────────────────
const getDriverReturns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const returns = yield prisma_1.default.order.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch driver return tasks" });
    }
});
exports.getDriverReturns = getDriverReturns;
// ─── Enhanced Assigned Orders for Driver ──────────────────────────────────────
const getAssignedOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const cursor = req.query.cursor ? req.query.cursor : undefined;
        const orders = yield prisma_1.default.order.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching assigned orders" });
    }
});
exports.getAssignedOrders = getAssignedOrders;
