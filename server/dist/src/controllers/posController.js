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
exports.customerDeposit = exports.getPOSOrderById = exports.sendPOSWhatsappDueReminders = exports.getPOSDueCustomers = exports.settleAccountBalance = exports.collectDuePayment = exports.getStoreConfig = exports.cancelPOSOrder = exports.getTodayPOSSales = exports.getCustomerHistory = exports.getStoreProducts = exports.processPOSOrder = exports.createOrUpdateCustomer = exports.updateWebOrderStatus = exports.getWebOrders = exports.searchCustomer = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const errors_1 = require("../utils/errors");
const client_1 = require("@prisma/client");
const io_1 = require("../sockets/io");
const idGenerator_1 = require("../utils/idGenerator");
const inventoryService_1 = require("../services/inventoryService");
const searchService_1 = require("../services/searchService");
const orderController_1 = require("./orderController");
const dueCalculationService_1 = require("../services/dueCalculationService");
const decimal_js_1 = __importDefault(require("decimal.js"));
// ─── Customer Management ──────────────────────────────────────────────────────
const searchCustomer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const rawQuery = String(req.query.query || "").trim().replace(/\\+/g, "");
    if (!rawQuery)
        return res.json([]);
    const cleanDigits = rawQuery.replace(/[^\d]/g, "");
    try {
        const orConditions = [
            { name: { contains: rawQuery, mode: 'insensitive' } },
            { phone: { contains: rawQuery } }
        ];
        if (rawQuery.includes("@")) {
            orConditions.push({ email: { contains: rawQuery, mode: 'insensitive' } });
        }
        if (cleanDigits.length >= 3) {
            orConditions.push({ phone: { contains: cleanDigits } });
            orConditions.push({ phone: { contains: `+91${cleanDigits}` } });
        }
        const customers = yield prisma_1.default.user.findMany({
            where: {
                OR: orConditions
            },
            take: 20,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                addresses: {
                    where: { isDefault: true },
                    take: 1,
                    select: { fullAddress: true }
                }
            }
        });
        const mapped = customers.map((c) => {
            var _a, _b;
            return ({
                id: c.id,
                name: c.name || "Customer",
                phone: c.phone,
                email: c.email || "",
                profileAddress: "",
                accountBalance: Number(c.accountBalance || 0),
                totalDue: Number(c.totalDue || 0),
                address: ((_b = (_a = c.addresses) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.fullAddress) || "",
                addresses: c.addresses || []
            });
        });
        res.json(mapped);
    }
    catch (error) {
        console.warn("[POS] searchCustomer fallback notice:", error === null || error === void 0 ? void 0 : error.message);
        try {
            const basic = yield prisma_1.default.user.findMany({
                where: {
                    OR: [
                        { name: { contains: rawQuery, mode: 'insensitive' } },
                        { phone: { contains: rawQuery } }
                    ]
                },
                take: 20,
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true
                }
            });
            return res.json(basic.map(b => ({
                id: b.id,
                name: b.name || "Customer",
                phone: b.phone,
                email: b.email || "",
                accountBalance: 0,
                totalDue: 0,
                address: "",
                addresses: []
            })));
        }
        catch (innerErr) {
            return res.json([]);
        }
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
                        profileAddress: true,
                        addresses: true
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
                items: (o.items || []).map(item => {
                    var _a, _b, _c, _d, _e, _f;
                    return ({
                        id: item.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        name: ((_a = item.variant) === null || _a === void 0 ? void 0 : _a.name)
                            ? `${((_b = item.product) === null || _b === void 0 ? void 0 : _b.name) || "Item"} (${item.variant.name})`
                            : (((_c = item.product) === null || _c === void 0 ? void 0 : _c.name) || "Item"),
                        productName: ((_d = item.product) === null || _d === void 0 ? void 0 : _d.name) || "Item",
                        image: ((_f = (_e = item.product) === null || _e === void 0 ? void 0 : _e.images) === null || _f === void 0 ? void 0 : _f[0]) || "",
                        quantity: Number(item.quantity || 0),
                        sellingPrice: Number(item.sellingPrice || 0)
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
            (0, io_1.getIo)().emit("REALTIME_REPORT_UPDATE", {
                orderId: orderId,
                status: targetStatus
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
    const sanitizedEmail = email && String(email).trim() !== "" ? String(email).trim() : null;
    const rawPhone = String(phone || "").trim();
    const cleanDigits = rawPhone.replace(/[^\d]/g, "");
    try {
        let existingCustomer = null;
        if (id) {
            existingCustomer = yield prisma_1.default.user.findUnique({ where: { id } });
        }
        else if (rawPhone) {
            existingCustomer = yield prisma_1.default.user.findFirst({
                where: {
                    OR: [
                        { phone: rawPhone },
                        ...(cleanDigits.length >= 5 ? [
                            { phone: cleanDigits },
                            { phone: `+91${cleanDigits}` }
                        ] : [])
                    ]
                }
            });
        }
        // If phone is changed, check for conflict with another user
        if (existingCustomer && rawPhone && existingCustomer.phone !== rawPhone) {
            const conflictUser = yield prisma_1.default.user.findFirst({
                where: {
                    id: { not: existingCustomer.id },
                    OR: [
                        { phone: rawPhone },
                        ...(cleanDigits.length >= 5 ? [
                            { phone: cleanDigits },
                            { phone: `+91${cleanDigits}` }
                        ] : [])
                    ]
                }
            });
            if (conflictUser) {
                return res.status(400).json({ message: "Phone number is already registered under another customer" });
            }
        }
        let customer;
        if (existingCustomer) {
            customer = yield prisma_1.default.user.update({
                where: { id: existingCustomer.id },
                data: {
                    name: name !== undefined ? String(name).trim() : existingCustomer.name,
                    phone: rawPhone ? rawPhone : existingCustomer.phone,
                    email: sanitizedEmail
                },
                include: { addresses: { where: { isDefault: true } } }
            });
        }
        else {
            customer = yield prisma_1.default.user.create({
                data: {
                    name: name ? String(name).trim() : "Customer",
                    phone: rawPhone,
                    email: sanitizedEmail,
                    role: "USER",
                    password: "POS_AUTO_GENERATED_" + Math.random().toString(36).slice(-8)
                },
                include: { addresses: { where: { isDefault: true } } }
            });
        }
        // Upsert default address
        if (address && String(address).trim()) {
            const existingAddr = yield prisma_1.default.address.findFirst({
                where: { userId: customer.id, isDefault: true }
            });
            if (existingAddr) {
                yield prisma_1.default.address.update({
                    where: { id: existingAddr.id },
                    data: { fullAddress: String(address).trim() }
                });
            }
            else {
                yield prisma_1.default.address.create({
                    data: {
                        userId: customer.id,
                        fullAddress: String(address).trim(),
                        tag: "Home",
                        isDefault: true
                    }
                });
            }
        }
        // Refetch full customer object with updated addresses
        const fullCustomer = yield prisma_1.default.user.findUnique({
            where: { id: customer.id },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                addresses: { where: { isDefault: true }, take: 1, select: { fullAddress: true } }
            }
        });
        const formatted = {
            id: (fullCustomer === null || fullCustomer === void 0 ? void 0 : fullCustomer.id) || customer.id,
            name: (fullCustomer === null || fullCustomer === void 0 ? void 0 : fullCustomer.name) || customer.name,
            phone: (fullCustomer === null || fullCustomer === void 0 ? void 0 : fullCustomer.phone) || customer.phone,
            email: (fullCustomer === null || fullCustomer === void 0 ? void 0 : fullCustomer.email) || "",
            profileAddress: "",
            address: ((_b = (_a = fullCustomer === null || fullCustomer === void 0 ? void 0 : fullCustomer.addresses) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.fullAddress) || (typeof address === "string" ? address : ""),
            addresses: (fullCustomer === null || fullCustomer === void 0 ? void 0 : fullCustomer.addresses) || []
        };
        res.json(Object.assign({ message: existingCustomer ? "Customer updated" : "Customer created", customer: formatted }, formatted));
    }
    catch (error) {
        next(error);
    }
});
exports.createOrUpdateCustomer = createOrUpdateCustomer;
// ─── POS Order Processing ─────────────────────────────────────────────────────
const processPOSOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const { customerId, items, paymentMethod, paymentDetails, discountAmount, couponId, packerId, isDelivery = false, deliveryAddress, duePaymentAmount = 0, paidAmount = 0, splitPayments, // Array of { method: "CASH" | "EASEBUZZ" | "WALLET", amount: number, transactionId?: string, denominations?: any }
    suspend = false, denominations, orderId } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    if (!staffId || !locationId) {
        return next(new errors_1.AppError("Operational context missing (Staff/Location)", 401));
    }
    if (!packerId && !suspend) {
        return next(new errors_1.AppError("Packer selection is compulsory for every bill. Please select a packer before checkout.", 400));
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
            existingPaidTotal = Number((0, dueCalculationService_1.calculateOrderPaidAmountDecimal)(existingOrder.payments).toFixed(2));
        }
        // Fetch current due BEFORE processing across all customer's active orders
        const prevOrders = yield prisma_1.default.order.findMany({
            where: (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ customerId }),
            include: { payments: true }
        });
        const previousDue = (0, dueCalculationService_1.calculateCustomerDues)(prevOrders).totalDue;
        let validatedStaffId = staffId;
        const staffExists = yield prisma_1.default.user.findUnique({
            where: { id: staffId },
            select: { id: true, name: true, role: true }
        });
        if (!staffExists) {
            console.warn(`[POS] Invalid Staff Session ID ${staffId}. Falling back to Root Admin.`);
            const rootAdmin = yield prisma_1.default.user.findFirst({
                where: { role: "ADMIN" },
                select: { id: true }
            });
            validatedStaffId = (rootAdmin === null || rootAdmin === void 0 ? void 0 : rootAdmin.id) || staffId;
        }
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const itemTotals = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const totalAmount = itemTotals - (discountAmount || 0);
            // Determine payment slices
            let paymentSlices = [];
            if (Array.isArray(splitPayments) && splitPayments.length > 0) {
                paymentSlices = splitPayments
                    .map(p => ({
                    method: String(p.method || "CASH").toUpperCase(),
                    amount: Number(p.amount || 0),
                    transactionId: p.transactionId,
                    denominations: p.denominations
                }))
                    .filter(p => p.amount > 0);
            }
            else if (paymentMethod && paymentMethod !== "CREDIT") {
                const pAmt = paidAmount !== undefined && paidAmount !== null && Number(paidAmount) >= 0
                    ? Number(paidAmount)
                    : totalAmount;
                if (pAmt > 0) {
                    paymentSlices = [{
                            method: String(paymentMethod).toUpperCase(),
                            amount: pAmt,
                            transactionId: paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.transactionId,
                            denominations: denominations
                        }];
                }
            }
            const effectivePaid = paymentSlices.reduce((sum, p) => sum + p.amount, 0);
            const totalPaidAmount = existingPaidTotal + effectivePaid;
            const isFull = totalPaidAmount >= totalAmount;
            const isCredit = paymentMethod === "CREDIT" || (paymentSlices.length === 0 && !suspend);
            const pStatus = totalPaidAmount <= 0 ? "PENDING" : (isFull ? "COMPLETED" : "PARTIAL");
            let order;
            if (existingOrder) {
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
                yield tx.orderItem.deleteMany({
                    where: { orderId: existingOrder.id }
                });
                let calculatedAddress = { type: "IN_STORE", note: "Handover at Counter / In-Store Pickup" };
                if (isDelivery) {
                    const cust = yield tx.user.findUnique({
                        where: { id: customerId },
                        include: { addresses: { where: { isDefault: true }, take: 1 } }
                    });
                    calculatedAddress = deliveryAddress || (((_a = cust === null || cust === void 0 ? void 0 : cust.addresses) === null || _a === void 0 ? void 0 : _a[0]) ? cust.addresses[0] : ((cust === null || cust === void 0 ? void 0 : cust.profileAddress) ? { fullAddress: cust.profileAddress } : { type: "DELIVERY", note: "Customer Delivery" }));
                }
                order = yield tx.order.update({
                    where: { id: existingOrder.id },
                    data: {
                        totalAmount: new client_1.Prisma.Decimal(totalAmount),
                        discountAmount: new client_1.Prisma.Decimal(discountAmount || 0),
                        status: (suspend ? "PENDING" : (existingOrder.status === "PENDING" ? "CONFIRMED" : existingOrder.status)),
                        paymentStatus: pStatus,
                        isPaid: isFull,
                        isCredit: isCredit,
                        isDelivery: Boolean(isDelivery),
                        shippingAddress: calculatedAddress,
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
                let calculatedAddress = { type: "IN_STORE", note: "Handover at Counter / In-Store Pickup" };
                if (isDelivery) {
                    const cust = yield tx.user.findUnique({
                        where: { id: customerId },
                        include: { addresses: { where: { isDefault: true }, take: 1 } }
                    });
                    calculatedAddress = deliveryAddress || (((_b = cust === null || cust === void 0 ? void 0 : cust.addresses) === null || _b === void 0 ? void 0 : _b[0]) ? cust.addresses[0] : ((cust === null || cust === void 0 ? void 0 : cust.profileAddress) ? { fullAddress: cust.profileAddress } : { type: "DELIVERY", note: "Customer Delivery" }));
                }
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
                        isCredit: isCredit,
                        isDelivery: Boolean(isDelivery),
                        shippingAddress: calculatedAddress,
                        channel: client_1.Channel.POS,
                        notes: `POS Transaction by ${staffId} [${isDelivery ? "DELIVERY" : "IN_STORE"}]${paymentSlices.length > 1 ? " (SPLIT_PAYMENT)" : ""}`,
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
                        },
                        statusHistory: {
                            create: {
                                status: (suspend ? "PENDING" : "CONFIRMED"),
                                remark: `POS Checkout (${pStatus}) [${isDelivery ? "DELIVERY" : "IN_STORE"}] - Paid: ₹${effectivePaid}`,
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
            // Record each payment slice
            if (!suspend && paymentSlices.length > 0) {
                for (const slice of paymentSlices) {
                    if (slice.method === "WALLET" && customerId) {
                        const cust = yield tx.user.findUnique({ where: { id: customerId } });
                        const curBal = Number((cust === null || cust === void 0 ? void 0 : cust.accountBalance) || 0);
                        const newBal = Math.max(0, curBal - slice.amount);
                        yield tx.user.update({
                            where: { id: customerId },
                            data: { accountBalance: new client_1.Prisma.Decimal(newBal) }
                        });
                        yield tx.walletTransaction.create({
                            data: {
                                userId: customerId,
                                amount: new client_1.Prisma.Decimal(slice.amount),
                                type: "PAYMENT_DEDUCTION",
                                paymentMethod: "WALLET",
                                referenceId: order.id,
                                balanceAfter: new client_1.Prisma.Decimal(newBal),
                                notes: `Settlement for POS Bill #${order.id}`,
                                createdBy: staffId
                            }
                        });
                    }
                    yield tx.payment.create({
                        data: {
                            orderId: order.id,
                            amount: new client_1.Prisma.Decimal(slice.amount),
                            method: slice.method,
                            status: "SUCCESS",
                            transactionId: slice.transactionId || `POS_${slice.method}_${Date.now()}`,
                            denominations: slice.denominations || null
                        }
                    });
                    if (slice.method === "CASH" && slice.denominations && locationId) {
                        const activeShift = yield tx.cashierShift.findFirst({
                            where: { locationId, status: "OPEN" }
                        });
                        if (activeShift) {
                            const shiftDenominations = activeShift.currentDenominations
                                ? (typeof activeShift.currentDenominations === "string"
                                    ? JSON.parse(activeShift.currentDenominations)
                                    : activeShift.currentDenominations)
                                : {};
                            const received = slice.denominations.received || {};
                            const change = slice.denominations.change || {};
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
                                data: { currentDenominations: updatedDenominations }
                            });
                        }
                    }
                }
            }
            return order;
        }));
        // ─── SETTLE OLD DUES ────────────────────────────────────────────────
        let settledFromOld = 0;
        if (duePaymentAmount > 0 && paymentMethod !== "CREDIT" && customerId) {
            const unpaidOrders = yield prisma_1.default.order.findMany({
                where: Object.assign(Object.assign({}, (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ customerId })), { id: { not: result.id } }),
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });
            const allocation = (0, dueCalculationService_1.allocateBulkPaymentToBills)(duePaymentAmount, unpaidOrders);
            for (const alloc of allocation.allocations) {
                if (alloc.allocatedAmount <= 0)
                    continue;
                yield prisma_1.default.payment.create({
                    data: {
                        orderId: alloc.orderId,
                        amount: new client_1.Prisma.Decimal(alloc.allocatedAmount),
                        method: paymentMethod || "CASH",
                        status: "SUCCESS",
                        transactionId: `POS_SETTLE_${Date.now()}`
                    }
                });
                yield prisma_1.default.order.update({
                    where: { id: alloc.orderId },
                    data: { isPaid: alloc.isFullyPaid, paymentStatus: alloc.isFullyPaid ? "COMPLETED" : "PARTIAL" }
                });
            }
            settledFromOld = allocation.totalAllocated;
        }
        if (customerId) {
            try {
                yield (0, orderController_1.syncCustomerTotalDue)(customerId);
            }
            catch (_) { }
        }
        const finalOrder = yield prisma_1.default.order.findUnique({
            where: { id: result.id },
            include: {
                payments: true,
                staff: { select: { name: true } },
                location: { select: { name: true, contactNumber: true } }
            }
        });
        const currentBillDueResult = (0, dueCalculationService_1.calculateOrderDue)(finalOrder);
        const currentBillPaid = currentBillDueResult.paidAmount;
        const currentBillDue = currentBillDueResult.dueAmount;
        const netOutstanding = Number(new decimal_js_1.default(previousDue).minus(settledFromOld).plus(currentBillDue).toFixed(2));
        res.status(201).json({
            message: "POS Order Processed",
            order: finalOrder,
            dueSummary: {
                previousDue,
                settledFromOld,
                currentBillDue,
                netOutstanding
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
                    const isPaid = result.isPaid || result.paymentStatus === "COMPLETED" || result.paymentStatus === "PAID";
                    const isPartial = result.paymentStatus === "PARTIAL";
                    const paymentModeDesc = finalOrder.payments.length > 1
                        ? finalOrder.payments.map((p) => `${p.method}: ₹${Number(p.amount)}`).join(", ")
                        : (((_c = finalOrder.payments[0]) === null || _c === void 0 ? void 0 : _c.method) || (finalOrder.isCredit ? "DUE ON ACCOUNT" : "CASH"));
                    const posPaidAmount = Number((_d = result.paidAmount) !== null && _d !== void 0 ? _d : (isPaid ? totalAmount : Math.max(0, totalAmount - currentBillDue)));
                    const { NotificationService } = require("../modules/messaging");
                    NotificationService.getInstance().notifyBillCreated({
                        orderId,
                        userId: customerId,
                        customerName: user.name || "Customer",
                        customerPhone: user.phone,
                        totalAmount,
                        paidAmount: posPaidAmount,
                        dueAmount: isPaid ? 0 : (isPartial ? currentBillDue : totalAmount),
                        paymentMode: paymentModeDesc,
                        isPaid,
                        locationId: finalOrder.locationId || undefined,
                        actorId: (_e = req.user) === null || _e === void 0 ? void 0 : _e.userId
                    }).catch((err) => {
                        console.error("[POSController] WhatsApp Bill notification dispatch failure:", err);
                    });
                }
            }
            catch (err) {
                console.error("[POSController] Failed to send WhatsApp:", err);
            }
        }
    }
    catch (error) {
        if ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes("stock")) {
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
        let walletTransactions = [];
        try {
            walletTransactions = yield prisma_1.default.walletTransaction.findMany({
                where: { userId: customerId },
                orderBy: { createdAt: "desc" },
                take: 20
            });
        }
        catch (_b) {
            walletTransactions = [];
        }
        const targetChannel = req.query.channel ? req.query.channel : undefined;
        const [customerUser, orders] = yield Promise.all([
            prisma_1.default.user.findUnique({
                where: { id: customerId },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                    createdAt: true
                }
            }),
            prisma_1.default.order.findMany({
                where: Object.assign(Object.assign({ userId: customerId }, (targetChannel ? { channel: targetChannel } : {})), { status: { notIn: ["CANCELLED", "FAILED"] } }),
                include: {
                    items: { include: { product: { select: { name: true, sku: true } } } },
                    payments: true,
                    staff: { select: { name: true } },
                    location: { select: { name: true } }
                },
                orderBy: { createdAt: "desc" }
            })
        ]);
        const dueOrders = orders.filter(o => !o.isPaid &&
            o.paymentStatus !== "COMPLETED" &&
            o.paymentStatus !== "PAID" &&
            o.paymentStatus !== "SETTLED");
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        let todayDue = 0;
        let pastDue = 0;
        const calculatedWalletBalance = Math.max(0, walletTransactions.reduce((acc, tx) => {
            return tx.type === "DEPOSIT" ? acc + Number(tx.amount) : acc - Number(tx.amount);
        }, 0));
        const activeOrders = orders.filter(o => o.status !== "CANCELLED" && o.status !== "FAILED");
        const customerDueSummary = (0, dueCalculationService_1.calculateCustomerDues)(activeOrders);
        const enrichedOrders = orders.map(o => {
            const dueRes = (0, dueCalculationService_1.calculateOrderDue)(o);
            const isCompleted = !dueRes.isEligible;
            const isPartial = dueRes.paidAmount > 0 && dueRes.dueAmount > 0;
            return Object.assign(Object.assign({}, o), { paidAmount: dueRes.paidAmount, dueAmount: dueRes.dueAmount, billStatus: isCompleted ? "PAID" : (isPartial ? "PARTIAL" : "UNPAID") });
        });
        customerDueSummary.eligibleOrders.forEach(o => {
            if (new Date(o.createdAt || Date.now()) >= startOfToday) {
                todayDue += o.dueAmount;
            }
            else {
                pastDue += o.dueAmount;
            }
        });
        const totalSpend = customerDueSummary.totalSpend;
        const totalPaid = customerDueSummary.totalPaid;
        const totalDue = customerDueSummary.totalDue;
        const lastVisit = ((_a = orders[0]) === null || _a === void 0 ? void 0 : _a.createdAt) || null;
        res.json({
            customer: customerUser ? Object.assign(Object.assign({}, customerUser), { accountBalance: calculatedWalletBalance, totalDue: totalDue }) : null,
            orders: enrichedOrders,
            walletTransactions,
            summary: {
                totalOrders: activeOrders.length,
                totalSpend,
                totalPaid,
                totalDue,
                todayDue: Math.round(todayDue * 100) / 100,
                pastDue: Math.round(pastDue * 100) / 100,
                accountBalance: calculatedWalletBalance,
                lastVisit
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCustomerHistory = getCustomerHistory;
const getTodayPOSSales = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    let locationId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.locationId;
    const isGlobal = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "ADMIN" || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) === "SUPER_ADMIN";
    if (!locationId && isGlobal) {
        const loc = yield prisma_1.default.location.findFirst();
        locationId = loc === null || loc === void 0 ? void 0 : loc.id;
    }
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const orders = yield prisma_1.default.order.findMany({
            where: Object.assign(Object.assign({}, (locationId ? { locationId } : {})), { channel: "POS", status: { notIn: ["CANCELLED", "FAILED"] }, createdAt: {
                    gte: startOfToday,
                    lte: endOfToday
                } }),
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                        profileAddress: true
                    }
                },
                items: {
                    include: {
                        product: { select: { name: true, sku: true } }
                    }
                },
                payments: true,
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });
        let totalSales = 0;
        let cashSales = 0;
        let upiSales = 0;
        let creditSales = 0;
        let onlineSales = 0;
        const formattedOrders = orders.map(order => {
            var _a, _b;
            const amount = Number(order.totalAmount);
            totalSales += amount;
            const successfulPayments = order.payments ? order.payments.filter((p) => p.status === "SUCCESS" || !p.status) : [];
            let paidCash = 0;
            let paidUpi = 0;
            let paidOnline = 0;
            for (const p of successfulPayments) {
                const pAmt = Number(p.amount || 0);
                const method = String(p.method || "CASH").toUpperCase();
                if (method === "CASH" || method === "LIQUID_CASH") {
                    paidCash += pAmt;
                }
                else if (method === "UPI") {
                    paidUpi += pAmt;
                    paidOnline += pAmt;
                }
                else if (method === "ONLINE" || method === "CARD" || method === "WALLET" || method === "NET_BANKING") {
                    paidOnline += pAmt;
                }
                else {
                    paidCash += pAmt;
                }
            }
            const totalPaid = paidCash + paidOnline;
            const dueAmount = Math.max(0, amount - totalPaid);
            const mainMethod = order.isCredit ? "CREDIT" : (((_a = successfulPayments[0]) === null || _a === void 0 ? void 0 : _a.method) || (dueAmount > 0 ? "CREDIT" : "CASH"));
            cashSales += paidCash;
            upiSales += paidUpi;
            onlineSales += paidOnline;
            if (order.isCredit || mainMethod === "CREDIT" || !order.isPaid || dueAmount > 0) {
                const orderDue = (order.isCredit || mainMethod === "CREDIT") && totalPaid === 0 ? amount : dueAmount;
                creditSales += orderDue;
            }
            return {
                id: order.id,
                totalAmount: amount,
                status: order.status,
                paymentStatus: order.paymentStatus,
                isCredit: order.isCredit,
                isPaid: order.isPaid,
                paymentMethod: mainMethod,
                createdAt: order.createdAt,
                customer: order.user ? {
                    id: order.user.id,
                    name: order.user.name,
                    phone: order.user.phone,
                    email: order.user.email
                } : null,
                itemsCount: order.items.length,
                items: order.items,
                payments: order.payments,
                staffName: ((_b = order.staff) === null || _b === void 0 ? void 0 : _b.name) || "POS Cashier"
            };
        });
        res.json({
            summary: {
                totalSales,
                orderCount: orders.length,
                cashSales,
                upiSales,
                creditSales,
                onlineSales
            },
            orders: formattedOrders
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getTodayPOSSales = getTodayPOSSales;
const cancelPOSOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const orderId = req.params.orderId;
    const { reason, refundMode } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!staffId)
        return next(new errors_1.AppError("Unauthorized", 401));
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: { items: true, user: { select: { id: true, name: true, phone: true } } }
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
        // ── WhatsApp Notification Dispatch (Bill Cancelled) ────────────────
        if ((_b = order.user) === null || _b === void 0 ? void 0 : _b.phone) {
            try {
                const { NotificationService } = require("../modules/messaging");
                NotificationService.getInstance().notifyBillCancelled({
                    orderId,
                    customerPhone: order.user.phone,
                    customerName: order.user.name || "Customer",
                    cancellationReason: reason,
                    triggeredBy: staffId
                }).catch((err) => {
                    console.error("[POSController] WhatsApp Bill Cancelled dispatch failure:", err.message);
                });
            }
            catch (err) {
                console.warn("[POSController] Failed to dispatch WhatsApp cancellation notification:", err.message);
            }
        }
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
    var _a, _b, _c;
    const orderId = req.params.orderId;
    const { amount, method = "CASH", splitPayments, useWalletBalance = false, denominations, notes, transactionId } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    if (!staffId)
        return next(new errors_1.AppError("Unauthorized", 401));
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: { payments: true, user: { select: { id: true, name: true, phone: true } } }
        });
        if (!order)
            return next(new errors_1.AppError("Order not found", 404));
        const dueResult = (0, dueCalculationService_1.calculateOrderDue)(order);
        if (!dueResult.isEligible || dueResult.dueAmount <= 0) {
            return res.status(400).json({ message: "This bill has already been fully paid and settled." });
        }
        const paidAlready = dueResult.paidAmount;
        const orderTotal = dueResult.totalAmount;
        const remainingDue = dueResult.dueAmount;
        // Determine payment slices
        let paymentSlices = [];
        if (Array.isArray(splitPayments) && splitPayments.length > 0) {
            paymentSlices = splitPayments
                .map(p => ({
                method: String(p.method || "CASH").toUpperCase(),
                amount: Number(p.amount || 0),
                transactionId: p.transactionId,
                denominations: p.denominations
            }))
                .filter(p => p.amount > 0);
        }
        else {
            const payingAmt = amount !== undefined && amount !== null && Number(amount) > 0
                ? Number(amount)
                : remainingDue;
            paymentSlices = [{
                    method: String(method || "CASH").toUpperCase(),
                    amount: payingAmt,
                    transactionId: transactionId || `SETTLE_${Date.now()}`,
                    denominations: denominations
                }];
        }
        const totalPayingNow = paymentSlices.reduce((acc, p) => acc + p.amount, 0);
        if (totalPayingNow <= 0) {
            return res.status(400).json({ message: "Invalid payment amount specified." });
        }
        const toApplyTarget = Math.min(totalPayingNow, remainingDue);
        const overflow = totalPayingNow - toApplyTarget;
        const newTotalPaid = paidAlready + toApplyTarget;
        const isFull = newTotalPaid >= orderTotal;
        const customerId = order.userId;
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // Handle wallet deduction if applicable
            for (const slice of paymentSlices) {
                if (slice.method === "WALLET" || (useWalletBalance && slice.method === "ADVANCE")) {
                    try {
                        yield tx.walletTransaction.create({
                            data: {
                                userId: customerId,
                                amount: new client_1.Prisma.Decimal(slice.amount),
                                type: "DEBIT",
                                notes: `Bill #${order.id.slice(0, 8).toUpperCase()} settlement`,
                                orderId: order.id
                            }
                        });
                    }
                    catch (wErr) {
                        console.warn("[POS Bill Settle] Wallet transaction ledger notice:", wErr.message);
                    }
                }
                yield tx.payment.create({
                    data: {
                        orderId,
                        amount: new client_1.Prisma.Decimal(toApplyTarget),
                        method: slice.method,
                        status: "SUCCESS",
                        transactionId: slice.transactionId || `DUE_SETTLE_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
                        denominations: slice.method === "CASH" ? (slice.denominations || denominations || null) : null
                    }
                });
            }
            // Update target order status
            yield tx.order.update({
                where: { id: orderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: isFull ? "COMPLETED" : "PARTIAL",
                    statusHistory: {
                        create: {
                            status: order.status,
                            remark: `Bill settlement: ₹${toApplyTarget} collected (${paymentSlices.map(s => `${s.method}: ₹${s.amount}`).join(", ")}). Total Paid: ₹${newTotalPaid}/${orderTotal}`,
                            changedBy: staffId
                        }
                    }
                }
            });
            // If there's overflow money and customerId is present, roll over to settle customer's other unpaid orders
            if (overflow > 0 && customerId) {
                const otherUnpaid = yield tx.order.findMany({
                    where: Object.assign(Object.assign({}, (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ customerId })), { id: { not: orderId } }),
                    orderBy: { createdAt: "asc" },
                    include: { payments: true }
                });
                const overflowAllocation = (0, dueCalculationService_1.allocateBulkPaymentToBills)(overflow, otherUnpaid);
                for (const alloc of overflowAllocation.allocations) {
                    if (alloc.allocatedAmount <= 0)
                        continue;
                    yield tx.payment.create({
                        data: {
                            orderId: alloc.orderId,
                            amount: new client_1.Prisma.Decimal(alloc.allocatedAmount),
                            method: ((_a = paymentSlices[0]) === null || _a === void 0 ? void 0 : _a.method) || method || "CASH",
                            status: "SUCCESS",
                            transactionId: `POS_OVERFLOW_${Date.now()}_${alloc.orderId.slice(0, 6)}`
                        }
                    });
                    yield tx.order.update({
                        where: { id: alloc.orderId },
                        data: {
                            isPaid: alloc.isFullyPaid,
                            paymentStatus: alloc.isFullyPaid ? "COMPLETED" : "PARTIAL"
                        }
                    });
                }
            }
            // Update cashier shift cash denominations if CASH was collected
            const cashSlice = paymentSlices.find(s => s.method === "CASH");
            if (cashSlice && (cashSlice.denominations || denominations) && locationId) {
                try {
                    const activeShift = yield tx.cashierShift.findFirst({
                        where: { locationId, status: "OPEN" }
                    });
                    if (activeShift) {
                        const shiftDenominations = activeShift.currentDenominations
                            ? (typeof activeShift.currentDenominations === "string"
                                ? JSON.parse(activeShift.currentDenominations)
                                : activeShift.currentDenominations)
                            : {};
                        const denomObj = cashSlice.denominations || denominations;
                        const received = denomObj.received || {};
                        const change = denomObj.change || {};
                        const denominationsKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
                        const updatedDenominations = {};
                        for (const k of denominationsKeys) {
                            const currentCount = Number(shiftDenominations[k] || 0);
                            const receivedCount = Number(received[k] || 0);
                            const changeCount = Number(change[k] || 0);
                            updatedDenominations[k] = Math.max(0, currentCount + receivedCount - changeCount);
                        }
                        yield tx.cashierShift.update({
                            where: { id: activeShift.id },
                            data: { currentDenominations: updatedDenominations }
                        });
                    }
                }
                catch (shiftErr) {
                    console.warn("[POS Bill Settle] Cashier shift denomination update notice:", shiftErr.message);
                }
            }
            if (customerId) {
                yield (0, orderController_1.syncCustomerTotalDue)(customerId, tx);
            }
        }));
        // ── WhatsApp Notification Dispatch ────────────────────────────────
        if ((_c = order.user) === null || _c === void 0 ? void 0 : _c.phone) {
            try {
                const user = order.user;
                const totalAmount = orderTotal;
                const remainingDueAfter = Math.max(0, orderTotal - newTotalPaid);
                const paymentModeDesc = `${method || "CASH"}: ₹${totalPayingNow}`;
                const { NotificationService } = require("../modules/messaging");
                NotificationService.getInstance().notifyPaymentReceived({
                    paymentId: `PAY-${orderId}-${Date.now().toString().slice(-4)}`,
                    orderId,
                    customerPhone: user.phone,
                    customerName: user.name || "Customer",
                    amount: totalPayingNow,
                    paymentMethod: paymentModeDesc,
                    remainingBalance: remainingDueAfter,
                    triggeredBy: staffId
                }).catch((err) => {
                    console.error("[POS Bill Settle] WhatsApp Payment Received dispatch failure:", err.message);
                });
                NotificationService.getInstance().notifyBillCreated({
                    orderId,
                    customerPhone: user.phone,
                    customerName: user.name || "Customer",
                    totalAmount,
                    paidAmount: totalPayingNow,
                    dueAmount: remainingDueAfter,
                    paymentMode: paymentModeDesc,
                    triggeredBy: staffId
                }).catch((err) => {
                    console.error("[POS Bill Settle] WhatsApp Bill Status dispatch failure:", err.message);
                });
            }
            catch (wErr) {
                console.warn("[POS Bill Settle] WhatsApp notification dispatch warning:", wErr.message);
            }
        }
        res.json({
            success: true,
            message: isFull ? "Bill fully settled and cleared" : `Partial settlement of ₹${totalPayingNow} recorded`,
            isFull,
            settledAmount: totalPayingNow,
            order: {
                id: order.id,
                totalAmount: orderTotal,
                paidAmount: newTotalPaid,
                dueAmount: Math.max(0, orderTotal - newTotalPaid),
                paymentStatus: isFull ? "COMPLETED" : "PARTIAL",
                isPaid: isFull
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.collectDuePayment = collectDuePayment;
const settleAccountBalance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const customerId = String(req.params.customerId);
    const { amount, method, transactionId, denominations } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    if (!staffId)
        return next(new errors_1.AppError("Unauthorized", 401));
    try {
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const unpaid = yield tx.order.findMany({
                where: (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ customerId }),
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });
            const allocation = (0, dueCalculationService_1.allocateBulkPaymentToBills)(amount, unpaid);
            let firstPaymentSaved = false;
            for (const alloc of allocation.allocations) {
                if (alloc.allocatedAmount <= 0)
                    continue;
                yield tx.payment.create({
                    data: {
                        orderId: alloc.orderId,
                        amount: new client_1.Prisma.Decimal(alloc.allocatedAmount),
                        method: method || "CASH",
                        status: "SUCCESS",
                        transactionId: transactionId || `SETTLE_${Date.now()}`,
                        denominations: (!firstPaymentSaved && method === "CASH") ? (denominations || null) : null
                    }
                });
                firstPaymentSaved = true;
                yield tx.order.update({
                    where: { id: alloc.orderId },
                    data: {
                        isPaid: alloc.isFullyPaid,
                        paymentStatus: alloc.isFullyPaid ? "COMPLETED" : "PARTIAL"
                    }
                });
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
            yield (0, orderController_1.syncCustomerTotalDue)(customerId, tx);
            return { settled: allocation.totalAllocated };
        }));
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.settleAccountBalance = settleAccountBalance;
// ─── POS WhatsApp Due Reminders ────────────────────────────────────────────────
const getPOSDueCustomers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const isGlobal = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "ADMIN" || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "SUPER_ADMIN";
    let locationId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.locationId;
    if (req.query.locationId) {
        locationId = req.query.locationId === "all" ? undefined : String(req.query.locationId);
    }
    else if (isGlobal) {
        locationId = undefined; // Global admin sees all stores, unless explicitly filtered
    }
    try {
        const orders = yield prisma_1.default.order.findMany({
            where: (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ locationId }),
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true
                    }
                },
                payments: true
            },
            orderBy: { createdAt: "desc" }
        });
        const customerOrdersMap = {};
        for (const order of orders) {
            if (!order.user || !order.user.phone)
                continue;
            const uId = order.user.id;
            if (!customerOrdersMap[uId]) {
                customerOrdersMap[uId] = {
                    user: order.user,
                    orders: []
                };
            }
            customerOrdersMap[uId].orders.push(order);
        }
        const dueCustomers = [];
        for (const entry of Object.values(customerOrdersMap)) {
            const summary = (0, dueCalculationService_1.calculateCustomerDues)(entry.orders);
            if (summary.eligibleOrdersCount > 0 && summary.totalDue > 0) {
                dueCustomers.push({
                    id: entry.user.id,
                    name: entry.user.name || "Customer",
                    phone: entry.user.phone,
                    email: entry.user.email || "",
                    totalDue: summary.totalDue,
                    dueOrdersCount: summary.eligibleOrdersCount,
                    latestOrderId: ((_d = summary.eligibleOrders[0]) === null || _d === void 0 ? void 0 : _d.id) || ""
                });
            }
        }
        dueCustomers.sort((a, b) => b.totalDue - a.totalDue);
        res.json({ dueCustomers });
    }
    catch (error) {
        next(error);
    }
});
exports.getPOSDueCustomers = getPOSDueCustomers;
const sendPOSWhatsappDueReminders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { customerIds } = req.body;
    const isGlobal = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "ADMIN" || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === "SUPER_ADMIN";
    let locationId = (req.body.locationId || req.query.locationId || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.locationId));
    if (locationId === "all" || (isGlobal && !req.body.locationId && !req.query.locationId)) {
        locationId = undefined;
    }
    try {
        const { ReminderService } = require("../modules/messaging");
        const result = yield ReminderService.getInstance().sendDueReminders({
            customerIds: Array.isArray(customerIds) ? customerIds : undefined,
            locationId,
            triggeredBy: (_d = req.user) === null || _d === void 0 ? void 0 : _d.userId
        });
        res.json({
            message: `WhatsApp payment reminders sent to ${result.sentCount} customer(s).${result.skippedCount > 0 ? ` (${result.skippedCount} skipped due to 24h cooldown)` : ""}${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ""}`,
            sentCount: result.sentCount,
            skippedCount: result.skippedCount,
            failedCount: result.failedCount,
            results: result.results
        });
    }
    catch (error) {
        next(error);
    }
});
exports.sendPOSWhatsappDueReminders = sendPOSWhatsappDueReminders;
const getPOSOrderById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const idStr = String(req.params.orderId || "");
    try {
        const order = yield prisma_1.default.order.findFirst({
            where: {
                OR: [
                    { id: idStr },
                    { id: { startsWith: idStr } },
                    { id: { contains: idStr, mode: 'insensitive' } }
                ]
            },
            include: {
                user: { select: { id: true, name: true, phone: true, email: true } },
                items: { include: { product: { select: { name: true, sku: true } } } },
                payments: true
            }
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        res.json(order);
    }
    catch (error) {
        next(error);
    }
});
exports.getPOSOrderById = getPOSOrderById;
// ─── 9. Customer Advance Deposit / Credit Top-up ──────────────────────────────
const customerDeposit = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { customerId, amount, paymentMethod = "CASH", transactionId, notes } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!customerId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ message: "Valid customer and positive deposit amount are required." });
    }
    try {
        const depositAmt = Number(amount);
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const customer = yield tx.user.findUnique({
                where: { id: String(customerId) },
                select: { id: true, name: true, phone: true, accountBalance: true }
            });
            if (!customer) {
                throw new Error("Customer not found.");
            }
            const currentBalance = Number(customer.accountBalance || 0);
            const newBalance = currentBalance + depositAmt;
            yield tx.user.update({
                where: { id: String(customerId) },
                data: { accountBalance: new client_1.Prisma.Decimal(newBalance) }
            });
            const transaction = yield tx.walletTransaction.create({
                data: {
                    userId: String(customerId),
                    amount: new client_1.Prisma.Decimal(depositAmt),
                    type: "DEPOSIT",
                    paymentMethod: String(paymentMethod).toUpperCase(),
                    referenceId: transactionId || `DEP_${Date.now()}`,
                    balanceAfter: new client_1.Prisma.Decimal(newBalance),
                    notes: notes || "Advance Credit Deposit in POS",
                    createdBy: staffId || "STAFF"
                }
            });
            return { customer, newBalance, transaction };
        }));
        // Send WhatsApp confirmation if customer phone exists
        if (result.customer.phone) {
            try {
                const { NotificationService } = require("../modules/messaging");
                NotificationService.getInstance().notifyPaymentReceived({
                    paymentId: result.transaction.referenceId || `ADV-DEP-${Date.now().toString().slice(-4)}`,
                    orderId: "WALLET_ADVANCE",
                    customerPhone: result.customer.phone,
                    customerName: result.customer.name || "Customer",
                    amount: depositAmt,
                    paymentMethod: `${paymentMethod} (Advance Wallet Credit - Current Balance: ₹${result.newBalance})`,
                    triggeredBy: staffId
                }).catch((err) => {
                    console.warn("[Deposit WhatsApp warning]:", err.message);
                });
            }
            catch (err) {
                console.warn("[Deposit WhatsApp warning]:", err);
            }
        }
        res.status(201).json({
            message: `₹${depositAmt} deposited successfully into ${result.customer.name || 'Customer'}'s advance wallet.`,
            accountBalance: result.newBalance,
            transaction: result.transaction
        });
    }
    catch (error) {
        next(error);
    }
});
exports.customerDeposit = customerDeposit;
