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
exports.settleAccountBalance = exports.collectDuePayment = exports.getStoreConfig = exports.cancelPOSOrder = exports.getCustomerHistory = exports.getStoreProducts = exports.processPOSOrder = exports.createOrUpdateCustomer = exports.updateWebOrderStatus = exports.getWebOrders = exports.searchCustomer = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const errors_1 = require("../utils/errors");
const client_1 = require("@prisma/client");
const io_1 = require("../sockets/io");
const idGenerator_1 = require("../utils/idGenerator");
const inventoryService_1 = require("../services/inventoryService");
const searchService_1 = require("../services/searchService");
// ─── Customer Management ──────────────────────────────────────────────────────
const searchCustomer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.query;
    try {
        const customers = yield prisma_1.default.user.findMany({
            where: {
                role: "USER",
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query } },
                    { email: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 10,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                profileAddress: true,
                addresses: {
                    where: { isDefault: true },
                    take: 1
                }
            }
        });
        res.json(customers);
    }
    catch (error) {
        next(error);
    }
});
exports.searchCustomer = searchCustomer;
// ─── Web Orders for POS ───────────────────────────────────────────────────────
const getWebOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const locId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.locationId) ? String(req.user.locationId) : undefined;
    const { status, limit = "50" } = req.query;
    try {
        const validStatuses = [
            "PENDING",
            "CONFIRMED",
            "PROCESSING",
            "PACKED",
            "SHIPPED",
            "OUT_FOR_DELIVERY",
            "DELIVERED"
        ];
        const statusFilter = status
            ? String(status).split(",").map(s => s.trim()).filter(s => validStatuses.includes(s))
            : validStatuses;
        const orders = yield prisma_1.default.order.findMany({
            where: Object.assign({ channel: client_1.Channel.WEB, status: { in: statusFilter } }, (locId ? { locationId: locId } : {})),
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                        addresses: { where: { isDefault: true }, take: 1 }
                    }
                },
                items: {
                    include: {
                        product: { select: { id: true, name: true, sku: true, images: true } },
                        variant: { select: { id: true, name: true, price: true, weight: true, weightUnit: true } }
                    }
                },
                payments: true,
                staff: { select: { name: true } },
                location: { select: { name: true } },
                statusHistory: { orderBy: { createdAt: "desc" }, take: 5 }
            },
            orderBy: { createdAt: "desc" },
            take: Math.min(Number(limit) || 50, 100)
        });
        const mapped = orders.map(o => {
            var _a, _b, _c, _d, _e, _f;
            const rawAddress = o.shippingAddress;
            const addressString = typeof rawAddress === "string"
                ? rawAddress
                : ((rawAddress === null || rawAddress === void 0 ? void 0 : rawAddress.fullAddress) || (rawAddress === null || rawAddress === void 0 ? void 0 : rawAddress.address) || ((_c = (_b = (_a = o.user) === null || _a === void 0 ? void 0 : _a.addresses) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.fullAddress) || "Handover at Counter / Website Pickup");
            return {
                id: o.id,
                customerName: ((_d = o.user) === null || _d === void 0 ? void 0 : _d.name) || "Website Customer",
                customerPhone: ((_e = o.user) === null || _e === void 0 ? void 0 : _e.phone) || "",
                customerEmail: ((_f = o.user) === null || _f === void 0 ? void 0 : _f.email) || "",
                shippingAddress: addressString,
                items: o.items.map(item => {
                    var _a, _b;
                    return ({
                        id: item.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        name: ((_a = item.variant) === null || _a === void 0 ? void 0 : _a.name) ? `${item.product.name} (${item.variant.name})` : item.product.name,
                        productName: item.product.name,
                        image: ((_b = item.product.images) === null || _b === void 0 ? void 0 : _b[0]) || "",
                        quantity: Number(item.quantity),
                        sellingPrice: Number(item.sellingPrice)
                    });
                }),
                totalAmount: Number(o.totalAmount),
                discountAmount: Number(o.discountAmount),
                status: o.status,
                paymentStatus: o.paymentStatus,
                isPaid: o.isPaid,
                createdAt: o.createdAt,
                user: o.user,
                payments: o.payments,
                statusHistory: o.statusHistory
            };
        });
        res.json(mapped);
    }
    catch (error) {
        next(error);
    }
});
exports.getWebOrders = getWebOrders;
const updateWebOrderStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { orderId } = req.params;
    const { status, remark, packerId } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!staffId)
        return next(new errors_1.AppError("Unauthorized", 401));
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: String(orderId) },
            include: { items: true }
        });
        if (!order)
            return next(new errors_1.AppError("Order not found", 404));
        const targetStatus = status;
        const validStatuses = [
            "PENDING",
            "CONFIRMED",
            "PROCESSING",
            "PACKED",
            "SHIPPED",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED"
        ];
        if (!validStatuses.includes(targetStatus)) {
            return next(new errors_1.AppError("Invalid order status transition", 400));
        }
        let updatedOrder;
        if (targetStatus === "CANCELLED" && order.status !== "CANCELLED") {
            // Restore stock if cancelled
            yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                yield inventoryService_1.InventoryService.restoreStock({
                    items: (order.items || []).map((i) => ({
                        productId: i.productId,
                        variantId: i.variantId || undefined,
                        quantity: Number(i.quantity)
                    })),
                    locationId: order.locationId || "MAIN_WAREHOUSE",
                    staffId,
                    referenceId: `POS_WEB_CANCEL_${order.id}`
                }, tx);
                updatedOrder = yield tx.order.update({
                    where: { id: String(orderId) },
                    data: {
                        status: "CANCELLED",
                        statusHistory: {
                            create: {
                                status: "CANCELLED",
                                remark: remark || "Cancelled by POS Operator",
                                changedBy: staffId
                            }
                        }
                    }
                });
            }));
        }
        else {
            updatedOrder = yield prisma_1.default.order.update({
                where: { id: String(orderId) },
                data: Object.assign(Object.assign({ status: targetStatus }, (packerId ? { packerId } : {})), { statusHistory: {
                        create: {
                            status: targetStatus,
                            remark: remark || `Stage updated to ${targetStatus} by POS Operator`,
                            changedBy: staffId
                        }
                    } })
            });
        }
        // Notify socket subscribers in real time
        try {
            (0, io_1.getIo)().emit("ORDER_STATUS_CHANGED", {
                orderId: orderId,
                status: targetStatus,
                updatedBy: staffId
            });
            if (packerId) {
                (0, io_1.getIo)().to(packerId).emit("OP_NEW_ORDER", {
                    id: orderId,
                    status: targetStatus,
                    type: "PACKING"
                });
            }
        }
        catch (e) {
            console.error("[POSController] Socket emit failure:", e);
        }
        res.json({ message: `Order stage updated to ${targetStatus}`, order: updatedOrder });
    }
    catch (error) {
        next(error);
    }
});
exports.updateWebOrderStatus = updateWebOrderStatus;
const createOrUpdateCustomer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id, name, phone, email, address } = req.body;
    // Treat empty email as null to avoid unique constraint violations
    const sanitizedEmail = email && email.trim() !== "" ? email.trim() : null;
    try {
        if (id) {
            const customer = yield prisma_1.default.user.update({
                where: { id },
                data: Object.assign({ name,
                    phone, email: sanitizedEmail }, (address && {
                    addresses: {
                        upsert: {
                            where: { id: ((_a = (yield prisma_1.default.address.findFirst({ where: { userId: id, isDefault: true } }))) === null || _a === void 0 ? void 0 : _a.id) || 'new-address-id' },
                            update: { fullAddress: address },
                            create: { fullAddress: address, isDefault: true }
                        }
                    }
                })),
                include: { addresses: { where: { isDefault: true } } }
            });
            return res.json({ message: "Customer updated", customer });
        }
        else {
            // Check if customer with the same phone already exists
            const existingCustomer = yield prisma_1.default.user.findFirst({
                where: { phone }
            });
            if (existingCustomer) {
                // Update the existing customer instead
                const customer = yield prisma_1.default.user.update({
                    where: { id: existingCustomer.id },
                    data: Object.assign({ name, email: sanitizedEmail }, (address && {
                        addresses: {
                            upsert: {
                                where: { id: ((_b = (yield prisma_1.default.address.findFirst({ where: { userId: existingCustomer.id, isDefault: true } }))) === null || _b === void 0 ? void 0 : _b.id) || 'new-address-id' },
                                update: { fullAddress: address },
                                create: { fullAddress: address, isDefault: true }
                            }
                        }
                    })),
                    include: { addresses: { where: { isDefault: true } } }
                });
                return res.json({ message: "Customer updated", customer });
            }
            else {
                // New Customer
                const customer = yield prisma_1.default.user.create({
                    data: Object.assign({ name,
                        phone, email: sanitizedEmail, role: "USER", password: "POS_AUTO_GENERATED_" + Math.random().toString(36).slice(-8) }, (address && {
                        addresses: {
                            create: {
                                fullAddress: address,
                                isDefault: true
                            }
                        }
                    })),
                    include: { addresses: { where: { isDefault: true } } }
                });
                // Trigger welcome registration WhatsApp notification!
                try {
                    const { sendRegistrationThankYouViaWhatsapp } = require("../services/mbgcard");
                    sendRegistrationThankYouViaWhatsapp(customer.phone, customer.name || "Customer").catch((err) => {
                        console.error("[POS] Welcome WhatsApp dispatch failure:", err);
                    });
                }
                catch (err) {
                    console.error("[POS] Failed to send welcome WhatsApp:", err);
                }
                return res.json({ message: "Customer created", customer });
            }
        }
    }
    catch (error) {
        next(error);
    }
});
exports.createOrUpdateCustomer = createOrUpdateCustomer;
// ─── POS Order Processing ─────────────────────────────────────────────────────
const processPOSOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { customerId, items, paymentMethod, paymentDetails, discountAmount, couponId, packerId, duePaymentAmount = 0, paidAmount = 0, // NEW: Amount paid specifically for THIS bill
    suspend = false, denominations, orderId // NEW: Edit Bill support
     } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    if (!staffId || !locationId) {
        return next(new errors_1.AppError("Operational context missing (Staff/Location)", 401));
    }
    try {
        let existingOrder = null;
        let existingPaidTotal = 0;
        if (orderId) {
            existingOrder = yield prisma_1.default.order.findUnique({
                where: { id: orderId },
                include: { items: true, payments: true }
            });
            if (!existingOrder) {
                return next(new errors_1.AppError("Order not found for editing", 404));
            }
            existingPaidTotal = existingOrder.payments
                .filter((p) => p.status === "SUCCESS")
                .reduce((sum, p) => sum + Number(p.amount), 0);
        }
        // Fetch current due BEFORE processing
        const prevOrders = yield prisma_1.default.order.findMany({
            where: {
                userId: customerId,
                channel: client_1.Channel.POS,
                paymentStatus: { in: ["PENDING", "PARTIAL"] },
                status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
            },
            include: { payments: true }
        });
        const previousDue = prevOrders.reduce((acc, o) => acc + (Number(o.totalAmount) - o.payments.reduce((pAcc, p) => pAcc + Number(p.amount), 0)), 0);
        // 🛡️ RECOVERY: Verify Staff Existence (Avoid P2003 if DB was wiped/re-seeded)
        let validatedStaffId = staffId;
        const staffExists = yield prisma_1.default.user.findUnique({ where: { id: staffId } });
        if (!staffExists) {
            console.warn(`[POS] Invalid Staff Session ID ${staffId}. Falling back to Root Admin.`);
            const rootAdmin = yield prisma_1.default.user.findFirst({ where: { role: "ADMIN" } });
            validatedStaffId = (rootAdmin === null || rootAdmin === void 0 ? void 0 : rootAdmin.id) || staffId; // Fallback to root or keep original if absolutely zero users (though unlikely)
        }
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const itemTotals = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const totalAmount = itemTotals - (discountAmount || 0);
            // Determine payment status for THIS bill
            const effectivePaid = paymentMethod === "CREDIT" ? 0 : Number(paidAmount || totalAmount);
            const totalPaidAmount = existingPaidTotal + effectivePaid;
            const isFull = totalPaidAmount >= totalAmount;
            const pStatus = totalPaidAmount <= 0 ? "PENDING" : (isFull ? "COMPLETED" : "PARTIAL");
            let order;
            if (existingOrder) {
                // 1. Restore stock first if not cancelled or pending
                if (existingOrder.status !== "PENDING" && existingOrder.status !== "CANCELLED") {
                    yield inventoryService_1.InventoryService.restoreStock({
                        items: existingOrder.items.map((i) => ({
                            productId: i.productId,
                            variantId: i.variantId || null,
                            quantity: Number(i.quantity)
                        })),
                        locationId,
                        staffId,
                        referenceId: existingOrder.id
                    }, tx);
                }
                // 2. Delete old order items
                yield tx.orderItem.deleteMany({
                    where: { orderId: existingOrder.id }
                });
                // 3. Update order fields and create new items
                order = yield tx.order.update({
                    where: { id: existingOrder.id },
                    data: {
                        totalAmount: new client_1.Prisma.Decimal(totalAmount),
                        discountAmount: new client_1.Prisma.Decimal(discountAmount || 0),
                        status: (suspend ? "PENDING" : (existingOrder.status === "PENDING" ? "CONFIRMED" : existingOrder.status)),
                        paymentStatus: pStatus,
                        isPaid: isFull,
                        packerId,
                        staffId: validatedStaffId,
                        items: {
                            create: items.map((item) => ({
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.quantity,
                                sellingPrice: new client_1.Prisma.Decimal(item.price),
                                locationId
                            }))
                        }
                    }
                });
            }
            else {
                order = yield tx.order.create({
                    data: {
                        id: (0, idGenerator_1.generateOrderId)(),
                        userId: customerId,
                        locationId,
                        totalAmount: new client_1.Prisma.Decimal(totalAmount),
                        discountAmount: new client_1.Prisma.Decimal(discountAmount || 0),
                        status: (suspend ? "PENDING" : "CONFIRMED"),
                        paymentStatus: pStatus,
                        isPaid: isFull,
                        shippingAddress: { type: "POS_IN_STORE", note: "Handover at Counter" },
                        channel: client_1.Channel.POS,
                        notes: `POS Transaction by ${staffId}${!staffExists ? " (SESSION_RECOVERED)" : ""}`,
                        packerId,
                        staffId: validatedStaffId, // Use validated ID
                        items: {
                            create: items.map((item) => ({
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.quantity,
                                sellingPrice: new client_1.Prisma.Decimal(item.price),
                                locationId
                            }))
                        },
                        statusHistory: {
                            create: {
                                status: (suspend ? "PENDING" : "CONFIRMED"),
                                remark: `POS Checkout (${pStatus})`,
                                changedBy: staffId
                            }
                        }
                    }
                });
            }
            if (!suspend) {
                yield inventoryService_1.InventoryService.deductStock({
                    items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
                    locationId,
                    type: inventoryService_1.InventoryLogType.SALE,
                    staffId
                }, tx);
            }
            if (effectivePaid > 0 && !suspend) {
                yield tx.payment.create({
                    data: {
                        orderId: order.id,
                        amount: new client_1.Prisma.Decimal(effectivePaid),
                        method: paymentMethod,
                        status: "SUCCESS",
                        transactionId: (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.transactionId) || `POS_${Date.now()}`,
                        denominations: denominations || null
                    }
                });
                if (paymentMethod === "CASH" && denominations && locationId) {
                    const activeShift = yield tx.cashierShift.findFirst({
                        where: { locationId, status: "OPEN" }
                    });
                    if (activeShift) {
                        const shiftDenominations = activeShift.currentDenominations
                            ? (typeof activeShift.currentDenominations === "string"
                                ? JSON.parse(activeShift.currentDenominations)
                                : activeShift.currentDenominations)
                            : {};
                        const received = denominations.received || {};
                        const change = denominations.change || {};
                        const denominationsKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
                        const updatedDenominations = {};
                        for (const key of denominationsKeys) {
                            const currentCount = Number(shiftDenominations[key] || 0);
                            const receivedCount = Number(received[key] || 0);
                            const changeCount = Number(change[key] || 0);
                            updatedDenominations[key] = Math.max(0, currentCount + receivedCount - changeCount);
                        }
                        yield tx.cashierShift.update({
                            where: { id: activeShift.id },
                            data: {
                                currentDenominations: updatedDenominations
                            }
                        });
                    }
                }
            }
            return order;
        }));
        // ─── SETTLE OLD DUES ────────────────────────────────────────────────
        let settledFromOld = 0;
        if (duePaymentAmount > 0) {
            let remaining = Number(duePaymentAmount);
            const unpaidOrders = yield prisma_1.default.order.findMany({
                where: {
                    userId: customerId,
                    channel: client_1.Channel.POS,
                    id: { not: result.id },
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
                },
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });
            for (const oldOrder of unpaidOrders) {
                if (remaining <= 0)
                    break;
                const paid = oldOrder.payments.reduce((acc, p) => acc + Number(p.amount), 0);
                const due = Number(oldOrder.totalAmount) - paid;
                const toApply = Math.min(remaining, due);
                if (toApply > 0) {
                    yield prisma_1.default.payment.create({
                        data: {
                            orderId: oldOrder.id,
                            amount: new client_1.Prisma.Decimal(toApply),
                            method: paymentMethod || "CASH",
                            status: "SUCCESS",
                            transactionId: `POS_SETTLE_${Date.now()}`
                        }
                    });
                    const fullyPaid = (paid + toApply) >= Number(oldOrder.totalAmount);
                    yield prisma_1.default.order.update({
                        where: { id: oldOrder.id },
                        data: { isPaid: fullyPaid, paymentStatus: fullyPaid ? "COMPLETED" : "PARTIAL" }
                    });
                    remaining -= toApply;
                    settledFromOld += toApply;
                }
            }
        }
        const finalOrder = yield prisma_1.default.order.findUnique({
            where: { id: result.id },
            include: {
                payments: true,
                staff: { select: { name: true } }
            }
        });
        const currentBillPaid = finalOrder.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const currentBillDue = Number(finalOrder.totalAmount) - currentBillPaid;
        res.status(201).json({
            message: "POS Order Processed",
            order: finalOrder,
            dueSummary: {
                previousDue,
                settledFromOld,
                currentBillDue,
                netOutstanding: previousDue - settledFromOld + currentBillDue
            }
        });
        // 🔔 Alert Packer if assigned
        if (packerId && !suspend) {
            (0, io_1.getIo)().to(packerId).emit("OP_NEW_ORDER", {
                id: result.id,
                status: "CONFIRMED",
                type: "PACKING"
            });
        }
        // ── WhatsApp Notification Dispatch ────────────────────────────────
        if (customerId && !suspend) {
            try {
                const user = yield prisma_1.default.user.findUnique({ where: { id: customerId }, select: { name: true, phone: true } });
                if (user === null || user === void 0 ? void 0 : user.phone) {
                    const orderId = result.id;
                    const totalAmount = Number(result.totalAmount);
                    const paymentMode = paymentMethod === "CASH" ? "CASH" : (paymentMethod === "CREDIT" ? "DUE ON ACCOUNT" : "DIGITAL PAY");
                    const isPaid = result.isPaid || result.paymentStatus === "COMPLETED" || result.paymentStatus === "PAID";
                    const { sendInvoicePaidViaWhatsapp, sendInvoiceDueViaWhatsapp } = require("../services/mbgcard");
                    if (isPaid) {
                        sendInvoicePaidViaWhatsapp(user.phone, user.name || "Customer", orderId, totalAmount, paymentMode, orderId).catch((err) => {
                            console.error("[POSController] WhatsApp Invoice Paid dispatch failure:", err);
                        });
                    }
                    else {
                        const dueAmount = totalAmount;
                        sendInvoiceDueViaWhatsapp(user.phone, user.name || "Customer", orderId, totalAmount, paymentMode, dueAmount, customerId, orderId).catch((err) => {
                            console.error("[POSController] WhatsApp Invoice Due dispatch failure:", err);
                        });
                    }
                }
            }
            catch (err) {
                console.error("[POSController] Failed to send WhatsApp:", err);
            }
        }
    }
    catch (error) {
        if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("stock")) {
            return res.status(409).json({ message: error.message });
        }
        next(error);
    }
});
exports.processPOSOrder = processPOSOrder;
const getStoreProducts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let locationId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.locationId;
    if (!locationId && (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "ADMIN")) {
        const firstStore = yield prisma_1.default.location.findFirst();
        locationId = firstStore === null || firstStore === void 0 ? void 0 : firstStore.id;
    }
    if (!locationId)
        return next(new errors_1.AppError("Store context required.", 400));
    const { search } = req.query;
    try {
        let productIds = null;
        if (search) {
            const searchResults = yield searchService_1.SearchService.getInstance().search(search, {
                locationId: locationId,
                isActive: true,
                limit: 50
            });
            productIds = searchResults.hits.map((h) => h.id);
            if (!productIds || productIds.length === 0)
                return res.json([]);
        }
        const products = yield prisma_1.default.product.findMany({
            where: Object.assign({ isActive: true, inventory: { some: { locationId } } }, (productIds ? { id: { in: productIds } } : {})),
            select: {
                id: true,
                name: true,
                sku: true,
                slug: true,
                description: true,
                images: true,
                basePrice: true,
                weightUnit: true,
                categoryId: true,
                inventory: { where: { locationId } },
                variants: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        weight: true,
                        weightUnit: true,
                        isActive: true,
                        pricing: { where: { channel: 'POS', isActive: true } }
                    }
                },
                pricing: { where: { channel: 'POS', isActive: true } }
            }
        });
        res.json(products);
    }
    catch (error) {
        next(error);
    }
});
exports.getStoreProducts = getStoreProducts;
const getCustomerHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const customerId = req.params.customerId;
    try {
        const orders = yield prisma_1.default.order.findMany({
            where: { userId: customerId, channel: "POS" },
            include: {
                items: { include: { product: { select: { name: true, sku: true } } } },
                payments: true,
                staff: { select: { name: true } },
                location: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        // 🛡️ ACCURATE DUE: amount - SUM(payments) where paymentStatus != COMPLETED
        const dueOrders = orders.filter(o => o.paymentStatus !== "COMPLETED" && o.status !== "CANCELLED" && o.status !== "FAILED" && o.status !== "PAYMENT_PENDING");
        const totalDue = dueOrders.reduce((acc, o) => {
            const paid = o.payments.reduce((pAcc, p) => pAcc + Number(p.amount), 0);
            return acc + (Number(o.totalAmount) - paid);
        }, 0);
        const totalSpend = orders.filter(o => o.status !== "CANCELLED" && o.status !== "FAILED" && o.status !== "PAYMENT_PENDING").reduce((acc, o) => acc + Number(o.totalAmount), 0);
        const lastVisit = ((_a = orders[0]) === null || _a === void 0 ? void 0 : _a.createdAt) || null;
        res.json({
            orders,
            summary: { totalOrders: orders.length, totalSpend, totalDue, lastVisit }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCustomerHistory = getCustomerHistory;
const cancelPOSOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const orderId = req.params.orderId;
    const { reason, refundMode } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!staffId)
        return next(new errors_1.AppError("Unauthorized", 401));
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
        if (!order)
            return next(new errors_1.AppError("Order not found", 404));
        const daysSinceOrder = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceOrder > 7)
            return next(new errors_1.AppError("Cancellation window expired.", 400));
        if (order.status === "CANCELLED")
            return next(new errors_1.AppError("Order is already cancelled", 400));
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield inventoryService_1.InventoryService.restoreStock({
                items: order.items.map((i) => ({
                    productId: i.productId,
                    variantId: i.variantId,
                    quantity: i.quantity
                })),
                locationId: order.locationId || "MAIN_WAREHOUSE",
                staffId,
                referenceId: `POS_CANCEL_${order.id}`
            }, tx);
            yield tx.order.update({
                where: { id: orderId },
                data: {
                    status: "CANCELLED",
                    statusHistory: {
                        create: { status: "CANCELLED", remark: `POS Cancellation: ${reason}.`, changedBy: staffId }
                    }
                }
            });
        }));
        res.json({ message: "Order cancelled." });
    }
    catch (error) {
        next(error);
    }
});
exports.cancelPOSOrder = cancelPOSOrder;
const getStoreConfig = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    let locationId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.locationId;
    const isGlobal = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "ADMIN" || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) === "SUPER_ADMIN";
    if (!locationId && isGlobal) {
        const loc = yield prisma_1.default.location.findFirst();
        locationId = loc === null || loc === void 0 ? void 0 : loc.id;
    }
    if (!locationId) {
        return next(new errors_1.AppError(`No store context assigned to user ${(_d = req.user) === null || _d === void 0 ? void 0 : _d.userId}. Please link this account to a Regional Hub.`, 400));
    }
    try {
        const location = yield prisma_1.default.location.findUnique({ where: { id: locationId } });
        res.json(location);
    }
    catch (error) {
        next(error);
    }
});
exports.getStoreConfig = getStoreConfig;
const collectDuePayment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const orderId = req.params.orderId;
    const { amount, method } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!staffId)
        return next(new errors_1.AppError("Unauthorized", 401));
    try {
        const order = yield prisma_1.default.order.findUnique({ where: { id: orderId }, include: { payments: true } });
        if (!order)
            return next(new errors_1.AppError("Order not found", 404));
        const paidAlready = order.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const payingNow = Number(amount || (Number(order.totalAmount) - paidAlready));
        const totalPaid = paidAlready + payingNow;
        const isFull = totalPaid >= Number(order.totalAmount);
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.payment.create({
                data: {
                    orderId,
                    amount: new client_1.Prisma.Decimal(payingNow),
                    method: method || "CASH",
                    status: "SUCCESS",
                    transactionId: `DUE_COLLECT_${Date.now()}`
                }
            });
            yield tx.order.update({
                where: { id: orderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: isFull ? "COMPLETED" : "PARTIAL",
                    statusHistory: {
                        create: {
                            status: order.status,
                            remark: `Due payment collected: ₹${payingNow} via ${method || "CASH"}. Total Paid: ₹${totalPaid}`,
                            changedBy: staffId
                        }
                    }
                }
            });
        }));
        res.json({ message: "Payment recorded successfully", isFull });
    }
    catch (error) {
        next(error);
    }
});
exports.collectDuePayment = collectDuePayment;
const settleAccountBalance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { customerId } = req.params;
    const { amount, method, transactionId, denominations } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    if (!staffId)
        return next(new errors_1.AppError("Unauthorized", 401));
    try {
        let remaining = Number(amount);
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const unpaid = yield tx.order.findMany({
                where: {
                    userId: customerId,
                    channel: client_1.Channel.POS,
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
                },
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });
            let firstPaymentSaved = false;
            for (const order of unpaid) {
                if (remaining <= 0)
                    break;
                const paid = order.payments.reduce((acc, p) => acc + Number(p.amount), 0);
                const due = Number(order.totalAmount) - paid;
                const toApply = Math.min(remaining, due);
                if (toApply > 0) {
                    yield tx.payment.create({
                        data: {
                            orderId: order.id,
                            amount: new client_1.Prisma.Decimal(toApply),
                            method: method || "CASH",
                            status: "SUCCESS",
                            transactionId: transactionId || `SETTLE_${Date.now()}`,
                            denominations: (!firstPaymentSaved && method === "CASH") ? (denominations || null) : null
                        }
                    });
                    firstPaymentSaved = true;
                    const isFull = (paid + toApply) >= Number(order.totalAmount);
                    yield tx.order.update({ where: { id: order.id }, data: { isPaid: isFull, paymentStatus: isFull ? "COMPLETED" : "PARTIAL" } });
                    remaining -= toApply;
                }
            }
            if (method === "CASH" && denominations && locationId) {
                const activeShift = yield tx.cashierShift.findFirst({
                    where: { locationId, status: "OPEN" }
                });
                if (activeShift) {
                    const shiftDenominations = activeShift.currentDenominations
                        ? (typeof activeShift.currentDenominations === "string"
                            ? JSON.parse(activeShift.currentDenominations)
                            : activeShift.currentDenominations)
                        : {};
                    const received = denominations.received || {};
                    const change = denominations.change || {};
                    const denominationsKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
                    const updatedDenominations = {};
                    for (const key of denominationsKeys) {
                        const currentCount = Number(shiftDenominations[key] || 0);
                        const receivedCount = Number(received[key] || 0);
                        const changeCount = Number(change[key] || 0);
                        updatedDenominations[key] = Math.max(0, currentCount + receivedCount - changeCount);
                    }
                    yield tx.cashierShift.update({
                        where: { id: activeShift.id },
                        data: {
                            currentDenominations: updatedDenominations
                        }
                    });
                }
            }
            return { settled: Number(amount) - remaining };
        }));
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.settleAccountBalance = settleAccountBalance;
