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
exports.getCustomerDetailedReport = exports.getCustomerSalesAndDueReports = exports.closeShift = exports.getSalesReports = exports.openShift = exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
/**
 * Global Admin & Regional Hub Intelligence
 */
const getDashboardStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const role = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const queryLocationId = req.query.locationId;
    const locationId = queryLocationId || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId); // Filter for STORE_ADMIN or explicit locationId query
    const isGlobal = (role === "ADMIN" || role === "SUPER_ADMIN") && !queryLocationId;
    // Safety check: Regional users must have a location assigned
    if (!isGlobal && !locationId) {
        console.error(`[DASHBOARD-FAIL] Regional user ${(_c = req.user) === null || _c === void 0 ? void 0 : _c.userId} (${role}) has no locationId assigned.`);
        return res.json({
            metrics: { revenue: 0, todayRevenue: 0, totalRevenue: 0, expenses: 0, orders: 0, todayOrders: 0, totalOrders: 0, customers: 0, stores: 0 },
            stores: [], trending: [], customers: [], activeShift: null
        });
    }
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        // 1. Get Core Metrics (Today vs All-time)
        const [todayOrdersCount, todayRevenue, totalOrdersCount, totalRevenue, totalCustomers, totalStores, totalExpenses] = yield Promise.all([
            prisma_1.default.order.count({
                where: Object.assign(Object.assign({}, (isGlobal ? {} : { locationId })), { status: { notIn: ["CANCELLED", "FAILED"] }, createdAt: { gte: startOfToday } })
            }),
            prisma_1.default.order.aggregate({
                where: Object.assign(Object.assign({}, (isGlobal ? {} : { locationId })), { status: { notIn: ["CANCELLED", "FAILED"] }, createdAt: { gte: startOfToday } }),
                _sum: { totalAmount: true }
            }),
            prisma_1.default.order.count({
                where: Object.assign(Object.assign({}, (isGlobal ? {} : { locationId })), { status: { notIn: ["CANCELLED", "FAILED"] } })
            }),
            prisma_1.default.order.aggregate({
                where: Object.assign(Object.assign({}, (isGlobal ? {} : { locationId })), { status: { notIn: ["CANCELLED", "FAILED"] } }),
                _sum: { totalAmount: true }
            }),
            prisma_1.default.user.count({ where: { role: "USER" } }),
            prisma_1.default.location.count(),
            prisma_1.default.storeExpense.aggregate({
                where: Object.assign({}, (isGlobal ? {} : { locationId })),
                _sum: { amount: true }
            })
        ]);
        // 2. Performance by Store (Revenue Leaderboard)
        let storePerformance = [];
        if (isGlobal) {
            storePerformance = yield prisma_1.default.location.findMany({
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    _count: {
                        select: { orders: { where: { status: { not: "CANCELLED" } } } }
                    },
                    orders: {
                        where: { status: { not: "CANCELLED" } },
                        select: { totalAmount: true }
                    },
                    expenses: {
                        select: { amount: true }
                    }
                }
            });
            storePerformance = storePerformance.map(store => {
                const revenue = store.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
                const expenses = store.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
                return {
                    id: store.id,
                    name: store.name,
                    slug: store.slug,
                    orderCount: store._count.orders,
                    revenue,
                    expenses,
                    profit: revenue - expenses
                };
            }).sort((a, b) => b.profit - a.profit);
        }
        // 3. Trending Products per Location
        const trendingProducts = yield prisma_1.default.orderItem.groupBy({
            by: ['productId'],
            where: Object.assign(Object.assign({}, (isGlobal ? {} : { locationId })), { order: { status: { not: "CANCELLED" } } }),
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5
        });
        const trendingProductDetails = yield Promise.all(trendingProducts.map((p) => __awaiter(void 0, void 0, void 0, function* () {
            const details = yield prisma_1.default.product.findUnique({
                where: { id: p.productId },
                select: { name: true, sku: true, images: true }
            });
            return Object.assign(Object.assign({}, details), { sales: p._sum.quantity });
        })));
        // 4. Top Customers (Global only or Location specific)
        const topCustomers = yield prisma_1.default.order.groupBy({
            by: ['userId'],
            where: Object.assign(Object.assign({}, (isGlobal ? {} : { locationId })), { status: { not: "CANCELLED" } }),
            _sum: { totalAmount: true },
            _count: { userId: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 5
        });
        const topCustomerDetails = yield Promise.all(topCustomers.map((c) => __awaiter(void 0, void 0, void 0, function* () {
            const details = yield prisma_1.default.user.findUnique({
                where: { id: c.userId },
                select: { name: true, phone: true }
            });
            return Object.assign(Object.assign({}, details), { totalSpend: c._sum.totalAmount, orderCount: c._count.userId });
        })));
        // 5. Active Shift Summary (For Regional Managers / POS Operators)
        let activeShift = null;
        if (!isGlobal && locationId) {
            activeShift = yield prisma_1.default.cashierShift.findFirst({
                where: { locationId, status: "OPEN" },
                orderBy: { startTime: 'desc' },
                include: { staff: { select: { name: true } } }
            });
            if (activeShift) {
                // Calculate current available cash
                const posCashSales = yield prisma_1.default.payment.aggregate({
                    where: {
                        method: "CASH",
                        status: "SUCCESS",
                        order: {
                            locationId,
                            createdAt: { gte: activeShift.startTime }
                        }
                    },
                    _sum: { amount: true }
                });
                const expenses = yield prisma_1.default.storeExpense.aggregate({
                    where: {
                        locationId,
                        createdAt: { gte: activeShift.startTime }
                    },
                    _sum: { amount: true }
                });
                activeShift.currentEstimatedCash = Number(activeShift.openingCash) +
                    Number(posCashSales._sum.amount || 0) -
                    Number(expenses._sum.amount || 0);
            }
            else {
                // Return last closed shift info for balance continuity
                const lastShift = yield prisma_1.default.cashierShift.findFirst({
                    where: { locationId, status: "CLOSED" },
                    orderBy: { endTime: 'desc' }
                });
                activeShift = lastShift ? Object.assign(Object.assign({}, lastShift), { isHistorical: true }) : null;
            }
        }
        res.json({
            metrics: {
                revenue: Number(todayRevenue._sum.totalAmount || 0),
                todayRevenue: Number(todayRevenue._sum.totalAmount || 0),
                totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
                expenses: Number(totalExpenses._sum.amount || 0),
                orders: todayOrdersCount,
                todayOrders: todayOrdersCount,
                totalOrders: totalOrdersCount,
                customers: totalCustomers,
                stores: totalStores
            },
            stores: storePerformance,
            trending: trendingProductDetails,
            customers: topCustomerDetails,
            activeShift
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getDashboardStats = getDashboardStats;
/**
 * POS Shift Management Operations
 */
const openShift = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let { openingCash, notes, openingDenominations } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    if (!notes)
        notes = "";
    if (!staffId || !locationId)
        return res.status(401).json({ message: "Store context required" });
    try {
        const existing = yield prisma_1.default.cashierShift.findFirst({
            where: { locationId, status: "OPEN" }
        });
        if (existing)
            return res.status(400).json({ message: "A shift is already open at this location" });
        // User mentioned "record will be from last closing sales shift"
        // If openingCash is NOT provided, try to fetch it from the last closed shift
        let finalOpeningCash = openingCash;
        if (openingCash === undefined || openingCash === null || openingCash === "") {
            const lastShift = yield prisma_1.default.cashierShift.findFirst({
                where: { locationId, status: "CLOSED" },
                orderBy: { endTime: 'desc' }
            });
            finalOpeningCash = (lastShift === null || lastShift === void 0 ? void 0 : lastShift.closingCash) || 0;
        }
        // Sanitize staffId for virtual hub logins to prevent FK violations
        const prismaStaffId = (staffId && !staffId.startsWith("STORE_")) ? staffId : undefined;
        const shift = yield prisma_1.default.cashierShift.create({
            data: {
                staffId: prismaStaffId,
                locationId,
                openingCash: new client_1.Prisma.Decimal(finalOpeningCash),
                openingDenominations: openingDenominations || null,
                currentDenominations: openingDenominations || null,
                status: "OPEN",
                notes: notes + ((staffId === null || staffId === void 0 ? void 0 : staffId.startsWith("STORE_")) ? ` [Virtual Access: ${staffId}]` : "")
            }
        });
        res.status(201).json(shift);
    }
    catch (error) {
        next(error);
    }
});
exports.openShift = openShift;
/**
 * Advanced Sales Monitoring & Reports
 */
const getSalesReports = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const role = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const userLocationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    const isGlobal = role === "ADMIN" || role === "SUPER_ADMIN";
    try {
        const { locationId, startDate, endDate, channel, paymentMethod, isCredit, paymentStatus } = req.query;
        // Base where clause
        const where = {
            status: { not: "CANCELLED" }
        };
        // 1. Role-based Location Scoping
        if (!isGlobal) {
            where.locationId = userLocationId;
        }
        else if (locationId) {
            where.locationId = locationId;
        }
        // 2. Date Filtering
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                where.createdAt.gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                where.createdAt.lte = e;
            }
        }
        // 3. Channel Filter (WEB / POS)
        if (channel) {
            where.channel = channel;
        }
        // 4. Payment Type Logic
        if (isCredit !== undefined && isCredit !== "") {
            if (isCredit === "true") {
                // Credit or Due: order isCredit is true OR order isPaid is false (outstanding dues)
                where.OR = [
                    { isCredit: true },
                    { isPaid: false }
                ];
            }
            else {
                // Paid/Settled: isPaid is true AND isCredit is false
                where.isPaid = true;
                where.isCredit = false;
            }
        }
        // 5. Payment Method & Status through payments relation
        if (paymentMethod || paymentStatus) {
            let methodFilter = undefined;
            if (paymentMethod === "ONLINE") {
                methodFilter = { in: ["ONLINE", "CARD", "UPI", "NB", "WALLET", "NET_BANKING", "JUSPAY_REFUND"] };
            }
            else if (paymentMethod === "CASH") {
                methodFilter = { in: ["CASH", "LIQUID_CASH"] };
            }
            else if (paymentMethod === "COD") {
                methodFilter = { in: ["COD", "CASH_ON_DELIVERY"] };
            }
            else if (paymentMethod) {
                methodFilter = paymentMethod;
            }
            where.payments = {
                some: Object.assign(Object.assign({}, (methodFilter ? { method: methodFilter } : {})), (paymentStatus ? { status: paymentStatus } : {}))
            };
        }
        else if (paymentStatus) {
            where.paymentStatus = paymentStatus;
        }
        const orders = yield prisma_1.default.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                location: { select: { name: true } },
                user: { select: { name: true, phone: true } },
                payments: true,
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                inventory: true
                            }
                        }
                    }
                }
            }
        });
        // Calculate Aggregates for the filtered set
        const summary = orders.reduce((acc, order) => {
            acc.totalOrders += 1;
            acc.totalRevenue += Number(order.totalAmount);
            // Channel breakdown
            acc.byChannel[order.channel] = (acc.byChannel[order.channel] || 0) + Number(order.totalAmount);
            // Payment method breakdown (only successful payments)
            const successfulPayments = order.payments.filter(p => p.status === "SUCCESS");
            successfulPayments.forEach(p => {
                acc.byMethod[p.method] = (acc.byMethod[p.method] || 0) + Number(p.amount);
            });
            // Calculate outstanding due accurately: if order isCredit is true OR isPaid is false (not fully paid)
            if (order.isCredit || !order.isPaid) {
                const paidAmount = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                const remainingDue = Number(order.totalAmount) - paidAmount;
                if (remainingDue > 0) {
                    acc.totalDue += remainingDue;
                }
            }
            return acc;
        }, {
            totalOrders: 0,
            totalRevenue: 0,
            totalDue: 0,
            byChannel: {},
            byMethod: {}
        });
        res.json({
            summary,
            orders
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSalesReports = getSalesReports;
const closeShift = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { closingCash, notes, closingDenominations } = req.body;
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const locationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    try {
        const activeShift = yield prisma_1.default.cashierShift.findFirst({
            where: { locationId, status: "OPEN" }
        });
        if (!activeShift)
            return res.status(404).json({ message: "No active shift found" });
        // Calculate expected cash: Opening Cash + POS Sales (Cash method) - Store Expenses
        const posCashSales = yield prisma_1.default.payment.aggregate({
            where: {
                method: "CASH",
                status: "SUCCESS",
                order: {
                    locationId,
                    createdAt: { gte: activeShift.startTime }
                }
            },
            _sum: { amount: true }
        });
        const expenses = yield prisma_1.default.storeExpense.aggregate({
            where: {
                locationId,
                createdAt: { gte: activeShift.startTime }
            },
            _sum: { amount: true }
        });
        const expectedCash = Number(activeShift.openingCash) +
            Number(posCashSales._sum.amount || 0) -
            Number(expenses._sum.amount || 0);
        const closedShift = yield prisma_1.default.cashierShift.update({
            where: { id: activeShift.id },
            data: {
                status: "CLOSED",
                endTime: new Date(),
                closingCash: new client_1.Prisma.Decimal(closingCash),
                closingDenominations: closingDenominations || null,
                currentDenominations: closingDenominations || null,
                expectedCash: new client_1.Prisma.Decimal(expectedCash),
                notes: (activeShift.notes ? activeShift.notes + " | " : "") + (notes || "")
            }
        });
        res.json({ message: "Shift closed and reconciled", shift: closedShift });
    }
    catch (error) {
        next(error);
    }
});
exports.closeShift = closeShift;
/**
 * Customer Detailed Sales & Outstanding Dues Report
 */
const getCustomerSalesAndDueReports = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const role = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const userLocationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    const isGlobal = role === "ADMIN" || role === "SUPER_ADMIN";
    try {
        const { locationId, startDate, endDate, search, channel, dueFilter = "ALL", page = "1", limit = "10", sortBy = "totalDue", sortOrder = "desc" } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const searchStr = search ? String(search) : undefined;
        const locId = locationId ? String(locationId) : undefined;
        const startStr = startDate ? String(startDate) : undefined;
        const endStr = endDate ? String(endDate) : undefined;
        const channelStr = channel ? String(channel) : undefined;
        const dueFilterStr = String(dueFilter);
        const sortByStr = String(sortBy);
        const sortOrderStr = String(sortOrder);
        // Build target location filter
        let targetLocationId = undefined;
        if (!isGlobal) {
            targetLocationId = userLocationId;
        }
        else if (locId) {
            targetLocationId = locId;
        }
        // Fetch users matching search query
        const cleanDigits = searchStr ? searchStr.replace(/\D/g, "") : "";
        const userWhere = searchStr ? {
            OR: [
                { name: { contains: searchStr, mode: "insensitive" } },
                { phone: { contains: searchStr } },
                ...(cleanDigits ? [{ phone: { contains: cleanDigits } }] : []),
                { email: { contains: searchStr, mode: "insensitive" } },
                { orders: { some: { id: { contains: searchStr, mode: "insensitive" } } } }
            ]
        } : {};
        const users = yield prisma_1.default.user.findMany({
            where: userWhere,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                createdAt: true,
                orders: {
                    where: {
                        status: { notIn: ["CANCELLED", "FAILED"] }
                    },
                    select: {
                        id: true,
                        totalAmount: true,
                        paymentStatus: true,
                        isPaid: true,
                        status: true,
                        createdAt: true,
                        channel: true,
                        locationId: true,
                        payments: {
                            where: { status: "SUCCESS" },
                            select: {
                                amount: true,
                                method: true,
                                createdAt: true
                            }
                        },
                        location: {
                            select: { name: true }
                        }
                    }
                }
            }
        });
        // Compute aggregates in-memory
        const customerReports = users.map(user => {
            const allOrders = user.orders;
            const startDateObj = startStr ? (() => { const s = new Date(startStr); s.setHours(0, 0, 0, 0); return s; })() : null;
            const endDateObj = endStr ? (() => { const e = new Date(endStr); e.setHours(23, 59, 59, 999); return e; })() : null;
            // Filter orders for spend/count stats if date range / location / channel specified
            const dateFilteredOrders = allOrders.filter(o => {
                if (channelStr && o.channel !== channelStr)
                    return false;
                if (targetLocationId && o.locationId !== targetLocationId)
                    return false;
                if (startDateObj && o.createdAt < startDateObj)
                    return false;
                if (endDateObj && o.createdAt > endDateObj)
                    return false;
                return true;
            });
            const orderCount = dateFilteredOrders.length;
            const totalSpend = dateFilteredOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
            // Calculate total paid across date-filtered orders
            const totalPaid = dateFilteredOrders.reduce((sum, o) => {
                const orderPaid = o.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
                return sum + orderPaid;
            }, 0);
            // 🛡️ Calculate outstanding due: if date/channel/location filter is active, calculate due for filtered orders (e.g. Current Day Due)
            const targetDueOrders = (startStr || endStr || channelStr || targetLocationId) ? dateFilteredOrders : allOrders;
            const totalDue = targetDueOrders.reduce((sum, o) => {
                const isSettled = o.isPaid || o.paymentStatus === "COMPLETED" || o.paymentStatus === "PAID" || o.paymentStatus === "SETTLED" || o.status === "CANCELLED" || o.status === "FAILED";
                if (!isSettled) {
                    const paid = o.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
                    const due = Number(o.totalAmount) - paid;
                    return sum + (due > 0 ? due : 0);
                }
                return sum;
            }, 0);
            const lastVisit = allOrders.length > 0
                ? allOrders.reduce((latest, o) => o.createdAt > latest ? o.createdAt : latest, allOrders[0].createdAt)
                : null;
            // Get store locations user has shopped at
            const storesList = Array.from(new Set(allOrders.map(o => { var _a; return (_a = o.location) === null || _a === void 0 ? void 0 : _a.name; }).filter(Boolean)));
            return {
                id: user.id,
                name: user.name || "Walk-in Guest",
                phone: user.phone,
                email: user.email || "N/A",
                createdAt: user.createdAt,
                orderCount,
                totalSpend,
                totalPaid,
                totalDue,
                lastVisit,
                stores: storesList
            };
        });
        // If date range is specified (e.g. TODAY), filter out accounts with 0 orders and 0 due in that period
        let filteredReports = customerReports;
        if (startStr || endStr) {
            filteredReports = filteredReports.filter(c => c.orderCount > 0 || c.totalDue > 0);
        }
        // Apply dueFilter
        if (dueFilterStr === "HAS_DUE") {
            filteredReports = filteredReports.filter(c => c.totalDue > 0);
        }
        else if (dueFilterStr === "NO_DUE") {
            filteredReports = filteredReports.filter(c => c.totalDue === 0);
        }
        // Apply Sorting
        filteredReports.sort((a, b) => {
            let valA = a[sortByStr];
            let valB = b[sortByStr];
            if (valA === null || valA === undefined)
                return sortOrderStr === "desc" ? 1 : -1;
            if (valB === null || valB === undefined)
                return sortOrderStr === "desc" ? -1 : 1;
            if (typeof valA === "string") {
                return sortOrderStr === "desc"
                    ? valB.localeCompare(valA)
                    : valA.localeCompare(valB);
            }
            else if (valA instanceof Date) {
                return sortOrderStr === "desc"
                    ? valB.getTime() - valA.getTime()
                    : valA.getTime() - valB.getTime();
            }
            else {
                return sortOrderStr === "desc"
                    ? valB - valA
                    : valA - valB;
            }
        });
        // Calculate global summary for the filtered subset
        const globalSummary = filteredReports.reduce((acc, c) => {
            acc.totalSpend += c.totalSpend;
            acc.totalPaid += c.totalPaid;
            acc.totalDue += c.totalDue;
            if (c.totalDue > 0)
                acc.customersWithDue += 1;
            return acc;
        }, {
            totalSpend: 0,
            totalPaid: 0,
            totalDue: 0,
            customerCount: filteredReports.length,
            customersWithDue: 0
        });
        // Paginate
        const totalCustomers = filteredReports.length;
        const totalPages = Math.ceil(totalCustomers / limitNum);
        const paginatedReports = filteredReports.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        res.json({
            summary: globalSummary,
            customers: paginatedReports,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalCustomers,
                totalPages
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCustomerSalesAndDueReports = getCustomerSalesAndDueReports;
/**
 * Customer Detailed Ledger & Bill-wise Due Report
 */
const getCustomerDetailedReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const role = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
    const userLocationId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId;
    const isGlobal = role === "ADMIN" || role === "SUPER_ADMIN";
    const { customerId } = req.params;
    try {
        const { locationId, startDate, endDate, channel } = req.query;
        const locId = locationId ? String(locationId) : undefined;
        const startStr = startDate ? String(startDate) : undefined;
        const endStr = endDate ? String(endDate) : undefined;
        const channelStr = channel ? String(channel) : undefined;
        const custId = String(customerId);
        // Build target location filter
        let targetLocationId = undefined;
        if (!isGlobal) {
            targetLocationId = userLocationId;
        }
        else if (locId) {
            targetLocationId = locId;
        }
        const customer = yield prisma_1.default.user.findUnique({
            where: { id: custId },
            include: {
                addresses: {
                    where: { isDefault: true },
                    take: 1
                }
            }
        });
        if (!customer) {
            return res.status(404).json({ message: "Customer not found." });
        }
        // Fetch all orders and payments chronologically
        const orders = yield prisma_1.default.order.findMany({
            where: Object.assign(Object.assign(Object.assign({ userId: custId, status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] } }, (channelStr ? { channel: channelStr } : {})), (targetLocationId ? { locationId: targetLocationId } : {})), (startStr || endStr ? {
                createdAt: Object.assign(Object.assign({}, (startStr ? { gte: new Date(startStr) } : {})), (endStr ? { lte: new Date(endStr) } : {}))
            } : {})),
            include: {
                payments: {
                    where: { status: "SUCCESS" }
                },
                location: { select: { name: true } },
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "asc" }
        });
        const events = [];
        orders.forEach((order) => {
            var _a, _b;
            // Charge Event for the Order itself
            events.push({
                type: "CHARGE",
                date: order.createdAt,
                id: `charge_${order.id}`,
                referenceId: order.id,
                description: `POS Order Checkout #${order.id.slice(0, 8).toUpperCase()}${((_a = order.location) === null || _a === void 0 ? void 0 : _a.name) ? ` at ${order.location.name}` : ''}`,
                amount: Number(order.totalAmount),
                details: {
                    channel: order.channel,
                    status: order.status,
                    staffName: (_b = order.staff) === null || _b === void 0 ? void 0 : _b.name
                }
            });
            // Payment Events for successful payments associated with this order (excluding CREDIT records)
            order.payments.filter((p) => p.method !== "CREDIT").forEach((payment) => {
                events.push({
                    type: "PAYMENT",
                    date: payment.createdAt,
                    id: `payment_${payment.id}`,
                    referenceId: order.id,
                    description: `Payment for Order #${order.id.slice(0, 8).toUpperCase()} via ${payment.method}`,
                    amount: Number(payment.amount),
                    details: {
                        method: payment.method,
                        transactionId: payment.transactionId
                    }
                });
            });
        });
        // Sort events chronologically (ascending)
        events.sort((a, b) => a.date.getTime() - b.date.getTime());
        // Compute running balance of dues
        let runningBalance = 0;
        const ledger = events.map(event => {
            if (event.type === "CHARGE") {
                runningBalance += event.amount;
            }
            else {
                runningBalance -= event.amount;
            }
            return Object.assign(Object.assign({}, event), { runningBalance: Number(runningBalance.toFixed(2)) });
        });
        // Construct detailed bill-wise due list
        const unpaidBills = orders.filter((o) => o.paymentStatus !== "COMPLETED");
        const billWiseDues = unpaidBills.map((o) => {
            var _a, _b;
            const paidAmount = o.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
            const remainingDue = Number(o.totalAmount) - paidAmount;
            return {
                id: o.id,
                createdAt: o.createdAt,
                locationName: ((_a = o.location) === null || _a === void 0 ? void 0 : _a.name) || "Global",
                staffName: ((_b = o.staff) === null || _b === void 0 ? void 0 : _b.name) || "N/A",
                totalAmount: Number(o.totalAmount),
                paidAmount,
                remainingDue: remainingDue > 0 ? remainingDue : 0,
                paymentStatus: o.paymentStatus,
                status: o.status
            };
        }).filter(b => b.remainingDue > 0);
        // Summary Statistics
        const totalSpend = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const totalPaid = orders.reduce((sum, o) => {
            return sum + o.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
        }, 0);
        const outstandingDue = Number((totalSpend - totalPaid).toFixed(2));
        const lastVisit = orders.length > 0 ? orders[orders.length - 1].createdAt : null;
        res.json({
            customer: Object.assign(Object.assign({}, customer), { address: ((_d = (_c = customer.addresses) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.fullAddress) || customer.profileAddress || "N/A" }),
            summary: {
                totalOrders: orders.length,
                totalSpend,
                totalPaid,
                outstandingDue,
                lastVisit
            },
            ledger: ledger.reverse(), // Return in reverse chronological order for easy page view
            billWiseDues
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCustomerDetailedReport = getCustomerDetailedReport;
