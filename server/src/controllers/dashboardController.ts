import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { Prisma, Channel, Role } from "@prisma/client";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string; locationId?: string };
}

/**
 * Global Admin & Regional Hub Intelligence
 */
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    const queryLocationId = req.query.locationId as string;
    const locationId = queryLocationId || req.user?.locationId; // Filter for STORE_ADMIN or explicit locationId query
    const isGlobal = (role === "ADMIN" || role === "SUPER_ADMIN") && !queryLocationId;
    
    // Safety check: Regional users must have a location assigned
    if (!isGlobal && !locationId) {
        console.error(`[DASHBOARD-FAIL] Regional user ${req.user?.userId} (${role}) has no locationId assigned.`);
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
        const [
            todayOrdersCount,
            todayRevenue,
            totalOrdersCount, 
            totalRevenue, 
            totalCustomers, 
            totalStores,
            totalExpenses
        ] = await Promise.all([
            prisma.order.count({
                where: {
                    ...(isGlobal ? {} : { locationId }),
                    status: { notIn: ["CANCELLED", "FAILED"] },
                    createdAt: { gte: startOfToday }
                }
            }),
            prisma.order.aggregate({
                where: {
                    ...(isGlobal ? {} : { locationId }),
                    status: { notIn: ["CANCELLED", "FAILED"] },
                    createdAt: { gte: startOfToday }
                },
                _sum: { totalAmount: true }
            }),
            prisma.order.count({ 
                where: { 
                    ...(isGlobal ? {} : { locationId }),
                    status: { notIn: ["CANCELLED", "FAILED"] }
                } 
            }),
            prisma.order.aggregate({
                where: { 
                    ...(isGlobal ? {} : { locationId }),
                    status: { notIn: ["CANCELLED", "FAILED"] }
                },
                _sum: { totalAmount: true }
            }),
            prisma.user.count({ where: { role: "USER" } }),
            prisma.location.count(),
            prisma.storeExpense.aggregate({
                where: { 
                    ...(isGlobal ? {} : { locationId })
                },
                _sum: { amount: true }
            })
        ]);

        // 2. Performance by Store (Revenue Leaderboard)
        let storePerformance: any[] = [];
        if (isGlobal) {
            storePerformance = await prisma.location.findMany({
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
                const revenue = store.orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
                const expenses = store.expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
                return {
                    id: store.id,
                    name: store.name,
                    slug: store.slug,
                    orderCount: store._count.orders,
                    revenue,
                    expenses,
                    profit: revenue - expenses
                };
            }).sort((a,b) => b.profit - a.profit);
        }

        // 3. Trending Products per Location
        const trendingProducts = await prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
                ...(isGlobal ? {} : { locationId }),
                order: { status: { not: "CANCELLED" } }
            },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5
        });

        const trendingProductDetails = await Promise.all(
            trendingProducts.map(async (p) => {
                const details = await prisma.product.findUnique({
                    where: { id: p.productId },
                    select: { name: true, sku: true, images: true }
                });
                return { ...details, sales: p._sum.quantity };
            })
        );

        // 4. Top Customers (Global only or Location specific)
        const topCustomers = await prisma.order.groupBy({
            by: ['userId'],
            where: {
                ...(isGlobal ? {} : { locationId }),
                status: { not: "CANCELLED" }
            },
            _sum: { totalAmount: true },
            _count: { userId: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 5
        });

        const topCustomerDetails = await Promise.all(
            topCustomers.map(async (c) => {
                const details = await prisma.user.findUnique({
                    where: { id: c.userId },
                    select: { name: true, phone: true }
                });
                return { ...details, totalSpend: c._sum.totalAmount, orderCount: c._count.userId };
            })
        );

        // 5. Active Shift Summary (For Regional Managers / POS Operators)
        let activeShift: any = null;
        if (!isGlobal && locationId) {
            activeShift = await prisma.cashierShift.findFirst({
                where: { locationId, status: "OPEN" },
                orderBy: { startTime: 'desc' },
                include: { staff: { select: { name: true } } }
            });

            if (activeShift) {
                // Calculate current available cash
                const posCashSales = await prisma.payment.aggregate({
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

                const expenses = await prisma.storeExpense.aggregate({
                    where: {
                        locationId,
                        createdAt: { gte: activeShift.startTime }
                    },
                    _sum: { amount: true }
                });

                activeShift.currentEstimatedCash = Number(activeShift.openingCash) + 
                                                   Number(posCashSales._sum.amount || 0) - 
                                                   Number(expenses._sum.amount || 0);
            } else {
                // Return last closed shift info for balance continuity
                const lastShift = await prisma.cashierShift.findFirst({
                    where: { locationId, status: "CLOSED" },
                    orderBy: { endTime: 'desc' }
                });
                (activeShift as any) = lastShift ? { ...lastShift, isHistorical: true } : null;
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

    } catch (error) {
        next(error);
    }
};

/**
 * POS Shift Management Operations
 */
export const openShift = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let { openingCash, notes, openingDenominations } = req.body;
    const staffId = req.user?.userId;
    const locationId = req.user?.locationId;
    
    if (!notes) notes = "";

    if (!staffId || !locationId) return res.status(401).json({ message: "Store context required" });

    try {
        const existing = await prisma.cashierShift.findFirst({
            where: { locationId, status: "OPEN" }
        });

        if (existing) return res.status(400).json({ message: "A shift is already open at this location" });

        // User mentioned "record will be from last closing sales shift"
        // If openingCash is NOT provided, try to fetch it from the last closed shift
        let finalOpeningCash = openingCash;
        if (openingCash === undefined || openingCash === null || openingCash === "") {
            const lastShift = await prisma.cashierShift.findFirst({
                where: { locationId, status: "CLOSED" },
                orderBy: { endTime: 'desc' }
            });
            finalOpeningCash = lastShift?.closingCash || 0;
        }

        // Sanitize staffId for virtual hub logins to prevent FK violations
        const prismaStaffId = (staffId && !staffId.startsWith("STORE_")) ? staffId : undefined;

        const shift = await prisma.cashierShift.create({
            data: {
                staffId: prismaStaffId,
                locationId,
                openingCash: new Prisma.Decimal(finalOpeningCash),
                openingDenominations: openingDenominations || null,
                currentDenominations: openingDenominations || null,
                status: "OPEN",
                notes: notes + (staffId?.startsWith("STORE_") ? ` [Virtual Access: ${staffId}]` : "")
            }
        });

        res.status(201).json(shift);
    } catch (error) {
        next(error);
    }
};

/**
 * Advanced Sales Monitoring & Reports
 */
export const getSalesReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    const userLocationId = req.user?.locationId;
    const isGlobal = role === "ADMIN" || role === "SUPER_ADMIN";

    try {
        const { 
            locationId, 
            startDate, 
            endDate, 
            channel, 
            paymentMethod, 
            isCredit,
            paymentStatus 
        } = req.query;

        // Base where clause
        const where: any = {
            status: { not: "CANCELLED" }
        };

        // 1. Role-based Location Scoping
        if (!isGlobal) {
            where.locationId = userLocationId;
        } else if (locationId) {
            where.locationId = locationId as string;
        }

        // 2. Date Filtering
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                const s = new Date(startDate as string);
                s.setHours(0, 0, 0, 0);
                where.createdAt.gte = s;
            }
            if (endDate) {
                const e = new Date(endDate as string);
                e.setHours(23, 59, 59, 999);
                where.createdAt.lte = e;
            }
        }

        // 3. Channel Filter (WEB / POS)
        if (channel) {
            where.channel = channel as Channel;
        }

        // 4. Payment Type Logic
        if (isCredit !== undefined && isCredit !== "") {
            if (isCredit === "true") {
                // Credit or Due: order isCredit is true OR order isPaid is false (outstanding dues)
                where.OR = [
                    { isCredit: true },
                    { isPaid: false }
                ];
            } else {
                // Paid/Settled: isPaid is true AND isCredit is false
                where.isPaid = true;
                where.isCredit = false;
            }
        }

        // 5. Payment Method & Status through payments relation
        if (paymentMethod || paymentStatus) {
            let methodFilter: any = undefined;
            if (paymentMethod === "ONLINE") {
                methodFilter = { in: ["ONLINE", "CARD", "UPI", "NB", "WALLET", "NET_BANKING", "JUSPAY_REFUND"] };
            } else if (paymentMethod === "CASH") {
                methodFilter = { in: ["CASH", "LIQUID_CASH"] };
            } else if (paymentMethod === "COD") {
                methodFilter = { in: ["COD", "CASH_ON_DELIVERY"] };
            } else if (paymentMethod) {
                methodFilter = paymentMethod as string;
            }

            where.payments = {
                some: {
                    ...(methodFilter ? { method: methodFilter } : {}),
                    ...(paymentStatus ? { status: paymentStatus as string } : {})
                }
            };
        } else if (paymentStatus) {
             where.paymentStatus = paymentStatus as string;
        }

        const orders = await prisma.order.findMany({
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
            byChannel: {} as Record<string, number>,
            byMethod: {} as Record<string, number>
        });

        res.json({
            summary,
            orders
        });

    } catch (error) {
        next(error);
    }
};

export const closeShift = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { closingCash, notes, closingDenominations } = req.body;
    const staffId = req.user?.userId;
    const locationId = req.user?.locationId;

    try {
        const activeShift = await prisma.cashierShift.findFirst({
            where: { locationId, status: "OPEN" }
        });

        if (!activeShift) return res.status(404).json({ message: "No active shift found" });

        // Calculate expected cash: Opening Cash + POS Sales (Cash method) - Store Expenses
        const posCashSales = await prisma.payment.aggregate({
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

        const expenses = await prisma.storeExpense.aggregate({
            where: {
                locationId,
                createdAt: { gte: activeShift.startTime }
            },
            _sum: { amount: true }
        });

        const expectedCash = Number(activeShift.openingCash) + 
                             Number(posCashSales._sum.amount || 0) - 
                             Number(expenses._sum.amount || 0);

        const closedShift = await prisma.cashierShift.update({
            where: { id: activeShift.id },
            data: {
                status: "CLOSED",
                endTime: new Date(),
                closingCash: new Prisma.Decimal(closingCash),
                closingDenominations: closingDenominations || null,
                currentDenominations: closingDenominations || null,
                expectedCash: new Prisma.Decimal(expectedCash),
                notes: (activeShift.notes ? activeShift.notes + " | " : "") + (notes || "")
            }
        });

        res.json({ message: "Shift closed and reconciled", shift: closedShift });
    } catch (error) {
        next(error);
    }
};

/**
 * Customer Detailed Sales & Outstanding Dues Report
 */
export const getCustomerSalesAndDueReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    const userLocationId = req.user?.locationId;
    const isGlobal = role === "ADMIN" || role === "SUPER_ADMIN";

    try {
        const { 
            locationId, 
            startDate, 
            endDate, 
            search, 
            channel,
            dueFilter = "ALL",
            page = "1",
            limit = "10",
            sortBy = "totalDue",
            sortOrder = "desc"
        } = req.query;

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 10;

        const searchStr = search ? String(search) : undefined;
        const locId = locationId ? String(locationId) : undefined;
        const startStr = startDate ? String(startDate) : undefined;
        const endStr = endDate ? String(endDate) : undefined;
        const channelStr = channel ? String(channel) : undefined;
        const dueFilterStr = String(dueFilter);
        const sortByStr = String(sortBy);
        const sortOrderStr = String(sortOrder);

        // Build target location filter
        let targetLocationId: string | undefined = undefined;
        if (!isGlobal) {
            targetLocationId = userLocationId;
        } else if (locId) {
            targetLocationId = locId;
        }

        // Fetch users matching search query
        const cleanDigits = searchStr ? searchStr.replace(/\D/g, "") : "";
        const userWhere: Prisma.UserWhereInput = searchStr ? {
            OR: [
                { name: { contains: searchStr, mode: "insensitive" } },
                { phone: { contains: searchStr } },
                ...(cleanDigits ? [{ phone: { contains: cleanDigits } }] : []),
                { email: { contains: searchStr, mode: "insensitive" } },
                { orders: { some: { id: { contains: searchStr, mode: "insensitive" } } } }
            ]
        } : {};

        const users = await prisma.user.findMany({
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
                if (channelStr && o.channel !== channelStr) return false;
                if (targetLocationId && o.locationId !== targetLocationId) return false;
                if (startDateObj && o.createdAt < startDateObj) return false;
                if (endDateObj && o.createdAt > endDateObj) return false;
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
            const storesList = Array.from(new Set(allOrders.map(o => o.location?.name).filter(Boolean)));

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
        } else if (dueFilterStr === "NO_DUE") {
            filteredReports = filteredReports.filter(c => c.totalDue === 0);
        }

        // Apply Sorting
        filteredReports.sort((a, b) => {
            let valA: any = a[sortByStr as keyof typeof a];
            let valB: any = b[sortByStr as keyof typeof b];

            if (valA === null || valA === undefined) return sortOrderStr === "desc" ? 1 : -1;
            if (valB === null || valB === undefined) return sortOrderStr === "desc" ? -1 : 1;

            if (typeof valA === "string") {
                return sortOrderStr === "desc" 
                    ? valB.localeCompare(valA)
                    : valA.localeCompare(valB);
            } else if (valA instanceof Date) {
                return sortOrderStr === "desc"
                    ? valB.getTime() - valA.getTime()
                    : valA.getTime() - valB.getTime();
            } else {
                return sortOrderStr === "desc"
                    ? (valB as number) - (valA as number)
                    : (valA as number) - (valB as number);
            }
        });

        // Calculate global summary for the filtered subset
        const globalSummary = filteredReports.reduce((acc, c) => {
            acc.totalSpend += c.totalSpend;
            acc.totalPaid += c.totalPaid;
            acc.totalDue += c.totalDue;
            if (c.totalDue > 0) acc.customersWithDue += 1;
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

    } catch (error) {
        next(error);
    }
};

/**
 * Customer Detailed Ledger & Bill-wise Due Report
 */
export const getCustomerDetailedReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    const userLocationId = req.user?.locationId;
    const isGlobal = role === "ADMIN" || role === "SUPER_ADMIN";
    const { customerId } = req.params;

    try {
        const { 
            locationId, 
            startDate, 
            endDate,
            channel
        } = req.query;

        const locId = locationId ? String(locationId) : undefined;
        const startStr = startDate ? String(startDate) : undefined;
        const endStr = endDate ? String(endDate) : undefined;
        const channelStr = channel ? String(channel) : undefined;
        const custId = String(customerId);

        // Build target location filter
        let targetLocationId: string | undefined = undefined;
        if (!isGlobal) {
            targetLocationId = userLocationId;
        } else if (locId) {
            targetLocationId = locId;
        }

        const customer = await prisma.user.findUnique({
            where: { id: custId },
            include: {
                addresses: {
                    where: { isDefault: true },
                    take: 1
                }
            }
        }) as any;

        if (!customer) {
            return res.status(404).json({ message: "Customer not found." });
        }

        // Fetch all orders and payments chronologically
        const orders = await prisma.order.findMany({
            where: {
                userId: custId,
                status: { notIn: ["CANCELLED", "FAILED"] },
                ...(channelStr ? { channel: channelStr as Channel } : {}),
                ...(targetLocationId ? { locationId: targetLocationId } : {}),
                ...(startStr || endStr ? {
                    createdAt: {
                        ...(startStr ? { gte: new Date(startStr) } : {}),
                        ...(endStr ? { lte: new Date(endStr) } : {})
                    }
                } : {})
            },
            include: {
                payments: {
                    where: { status: "SUCCESS" }
                },
                location: { select: { name: true } },
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: "asc" }
        }) as any[];

        // Fetch all successful customer payments (including direct account settlements)
        const allCustomerPayments = await prisma.payment.findMany({
            where: {
                status: "SUCCESS",
                OR: [
                    { orderId: { in: orders.map((o: any) => o.id) } },
                    { order: { userId: custId } }
                ]
            },
            orderBy: { createdAt: "asc" }
        });

        // Construct Ledger events
        interface LedgerEvent {
            type: "CHARGE" | "PAYMENT";
            date: Date;
            id: string;
            referenceId: string;
            description: string;
            amount: number;
            runningBalance?: number;
            details?: any;
        }

        const events: LedgerEvent[] = [];
        const processedPaymentIds = new Set<string>();

        orders.forEach((order: any) => {
            // Charge Event for the Order itself
            events.push({
                type: "CHARGE",
                date: order.createdAt,
                id: `charge_${order.id}`,
                referenceId: order.id,
                description: `POS Order Checkout #${order.id.slice(0, 8).toUpperCase()}${order.location?.name ? ` at ${order.location.name}` : ''}`,
                amount: Number(order.totalAmount),
                details: {
                    channel: order.channel,
                    status: order.status,
                    staffName: order.staff?.name
                }
            });

            // Payment Events for successful payments associated with this order (excluding CREDIT records)
            order.payments.filter((p: any) => p.method !== "CREDIT").forEach((payment: any) => {
                processedPaymentIds.add(payment.id);
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

        // Add any account settlement payments that were not attached directly to orders
        allCustomerPayments.forEach((p: any) => {
            if (!processedPaymentIds.has(p.id)) {
                processedPaymentIds.add(p.id);
                events.push({
                    type: "PAYMENT",
                    date: p.createdAt,
                    id: `payment_${p.id}`,
                    referenceId: p.orderId || custId,
                    description: `Account Settlement via ${p.method || "ONLINE"}`,
                    amount: Number(p.amount),
                    details: {
                        method: p.method,
                        transactionId: p.transactionId
                    }
                });
            }
        });

        // Sort events chronologically (ascending)
        events.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Compute running balance of dues
        let runningBalance = 0;
        const ledger = events.map(event => {
            if (event.type === "CHARGE") {
                runningBalance += event.amount;
            } else {
                runningBalance -= event.amount;
            }
            return {
                ...event,
                runningBalance: Number(runningBalance.toFixed(2))
            };
        });

        // Construct detailed bill-wise due list
        const unpaidBills = orders.filter((o: any) => !o.isPaid && o.paymentStatus !== "COMPLETED" && o.paymentStatus !== "PAID" && o.paymentStatus !== "SETTLED");
        const billWiseDues = unpaidBills.map((o: any) => {
            const paidAmount = (o.payments as any[]).reduce((pSum: number, p: any) => pSum + Number(p.amount), 0);
            const remainingDue = Number(o.totalAmount) - paidAmount;
            return {
                id: o.id,
                createdAt: o.createdAt,
                locationName: o.location?.name || "Global",
                staffName: o.staff?.name || "N/A",
                totalAmount: Number(o.totalAmount),
                paidAmount,
                remainingDue: remainingDue > 0 ? remainingDue : 0,
                paymentStatus: o.paymentStatus,
                status: o.status
            };
        }).filter(b => b.remainingDue > 0);

        // Summary Statistics
        const totalSpend = orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
        const totalPaid = orders.reduce((sum: number, o: any) => {
            return sum + (o.payments as any[]).reduce((pSum: number, p: any) => pSum + Number(p.amount), 0);
        }, 0);
        const outstandingDue = Number((totalSpend - totalPaid).toFixed(2));
        const lastVisit = orders.length > 0 ? orders[orders.length - 1].createdAt : null;

        res.json({
            customer: {
                ...customer,
                address: customer.addresses?.[0]?.fullAddress || customer.profileAddress || "N/A"
            },
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

    } catch (error) {
        next(error);
    }
};

/**
 * Daily Product-Wise Sales & Inventory Report
 */
export const getDailyProductReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { date, locationId, categoryId, search } = req.query;
    const caller = req.user;

    try {
        const targetDate = date ? new Date(String(date)) : new Date();
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

        let targetLocationId = locationId && locationId !== "ALL" ? String(locationId) : caller?.locationId;
        if (caller?.role === "ADMIN" || caller?.role === "SUPER_ADMIN") {
            if (locationId === "ALL" || !locationId) {
                targetLocationId = undefined; // All stores
            }
        }

        // 1. Fetch Products
        const productWhere: any = { isActive: true };
        if (categoryId && categoryId !== "ALL") {
            productWhere.categoryId = String(categoryId);
        }
        if (search) {
            const q = String(search).trim();
            productWhere.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } }
            ];
        }

        const products = await prisma.product.findMany({
            where: productWhere,
            include: {
                category: { select: { id: true, name: true } },
                inventory: targetLocationId ? { where: { locationId: targetLocationId } } : true,
                variants: { select: { id: true, name: true, price: true } }
            },
            orderBy: { name: "asc" }
        });

        // 2. Fetch OrderItems on this date
        const orderItems = await prisma.orderItem.findMany({
            where: {
                order: {
                    createdAt: { gte: startOfDay, lte: endOfDay },
                    status: { notIn: ["CANCELLED", "FAILED"] },
                    ...(targetLocationId ? { locationId: targetLocationId } : {})
                }
            },
            select: {
                productId: true,
                variantId: true,
                quantity: true,
                sellingPrice: true
            }
        });

        // 3. Fetch Received PO items on this date
        const poItems = await prisma.purchaseOrderItem.findMany({
            where: {
                purchaseOrder: {
                    createdAt: { gte: startOfDay, lte: endOfDay },
                    status: { in: ["RECEIVED", "PARTIALLY_RECEIVED", "APPROVED", "ORDERED"] },
                    ...(targetLocationId ? { locationId: targetLocationId } : {})
                }
            },
            select: {
                productId: true,
                variantId: true,
                receivedQty: true,
                approvedQty: true,
                requestedQty: true,
                buyingPrice: true
            }
        });

        // 4. Fetch Mortality Logs on this date
        const mortalityLogs = await prisma.mortalityLog.findMany({
            where: {
                createdAt: { gte: startOfDay, lte: endOfDay },
                ...(targetLocationId ? { locationId: targetLocationId } : {})
            },
            select: {
                productId: true,
                quantity: true,
                totalLoss: true
            }
        });

        // Group aggregation maps
        const salesMap = new Map<string, { qty: number; revenue: number }>();
        orderItems.forEach(item => {
            const current = salesMap.get(item.productId) || { qty: 0, revenue: 0 };
            const q = Number(item.quantity);
            const r = q * Number(item.sellingPrice);
            salesMap.set(item.productId, { qty: current.qty + q, revenue: current.revenue + r });
        });

        const inwardMap = new Map<string, { qty: number; cost: number }>();
        poItems.forEach(item => {
            const current = inwardMap.get(item.productId) || { qty: 0, cost: 0 };
            const q = Number(item.receivedQty || item.approvedQty || item.requestedQty || 0);
            const c = q * Number(item.buyingPrice || 0);
            inwardMap.set(item.productId, { qty: current.qty + q, cost: current.cost + c });
        });

        const mortalityMap = new Map<string, { qty: number; loss: number }>();
        mortalityLogs.forEach(log => {
            const current = mortalityMap.get(log.productId) || { qty: 0, loss: 0 };
            const q = Number(log.quantity);
            const l = Number(log.totalLoss);
            mortalityMap.set(log.productId, { qty: current.qty + q, loss: current.loss + l });
        });

        let totalRevenueSum = 0;
        let totalSoldUnitsSum = 0;
        let totalInwardedUnitsSum = 0;
        let totalLossSum = 0;

        const report = products.map(product => {
            const currentStock = product.inventory.reduce((acc: number, inv: any) => acc + Number(inv.currentStock || 0), 0);
            const sales = salesMap.get(product.id) || { qty: 0, revenue: 0 };
            const inward = inwardMap.get(product.id) || { qty: 0, cost: 0 };
            const mortality = mortalityMap.get(product.id) || { qty: 0, loss: 0 };

            // Opening stock estimated
            const openingStock = Math.max(0, currentStock + sales.qty + mortality.qty - inward.qty);

            totalRevenueSum += sales.revenue;
            totalSoldUnitsSum += sales.qty;
            totalInwardedUnitsSum += inward.qty;
            totalLossSum += mortality.loss;

            const avgSellingPrice = sales.qty > 0 ? Number((sales.revenue / sales.qty).toFixed(2)) : Number(product.basePrice || 0);

            return {
                id: product.id,
                name: product.name,
                sku: product.sku || "N/A",
                category: product.category?.name || "Uncategorized",
                weightUnit: product.weightUnit,
                basePrice: Number(product.basePrice || 0),
                openingStock: Number(openingStock.toFixed(2)),
                inwardedQty: Number(inward.qty.toFixed(2)),
                soldQty: Number(sales.qty.toFixed(2)),
                revenue: Number(sales.revenue.toFixed(2)),
                mortalityQty: Number(mortality.qty.toFixed(2)),
                mortalityLoss: Number(mortality.loss.toFixed(2)),
                closingStock: Number(currentStock.toFixed(2)),
                avgSellingPrice
            };
        });

        res.json({
            date: targetDate.toISOString().split("T")[0],
            locationId: targetLocationId || "ALL",
            report,
            totals: {
                totalProducts: report.length,
                totalRevenue: Number(totalRevenueSum.toFixed(2)),
                totalSoldUnits: Number(totalSoldUnitsSum.toFixed(2)),
                totalInwardedUnits: Number(totalInwardedUnitsSum.toFixed(2)),
                totalMortalityLoss: Number(totalLossSum.toFixed(2))
            }
        });
    } catch (error) {
        next(error);
    }
};


