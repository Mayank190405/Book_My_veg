
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

export class AnalyticsService {
    /**
     * Real-time dashboard stats for a given date/location.
     * Returns: Sales, Weight Sold, Wastage (mortality), and top products.
     */
    static async getDashboard(locationId: string, date?: Date) {
        const day = date ? new Date(date) : new Date();
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        // 1. Total Sales from orders
        const salesAgg = await prisma.order.aggregate({
            where: {
                status: { in: ["DELIVERED", "CONFIRMED"] },
                createdAt: { gte: day, lt: nextDay }
            },
            _sum: { totalAmount: true },
            _count: { id: true }
        });

        // 2. Weight sold from InventoryLog (SALE type)
        const weightAgg = await prisma.inventoryLog.aggregate({
            where: {
                locationId,
                type: "SALE",
                createdAt: { gte: day, lt: nextDay }
            },
            _sum: { delta: true }
        });

        // 3. Wastage from MortalityLog
        const wastageAgg = await prisma.mortalityLog.aggregate({
            where: {
                locationId,
                createdAt: { gte: day, lt: nextDay }
            },
            _sum: { quantity: true },
            _count: { id: true }
        });

        // 4. Top 5 products by order items
        const topProducts = await prisma.orderItem.groupBy({
            by: ["productId"],
            where: {
                order: {
                    status: { in: ["DELIVERED", "CONFIRMED"] },
                    createdAt: { gte: day, lt: nextDay }
                }
            },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: 5
        });

        const topProductsWithNames = await Promise.all(
            topProducts.map(async (tp) => {
                const product = await prisma.product.findUnique({
                    where: { id: tp.productId },
                    select: { name: true, images: true }
                });
                return { ...tp, product };
            })
        );

        return {
            date: day.toISOString().split("T")[0],
            locationId,
            totalSales: Number(salesAgg._sum.totalAmount || 0),
            totalOrders: salesAgg._count.id,
            weightSoldKg: Math.abs(Number(weightAgg._sum.delta || 0)),
            wastagePieces: Number(wastageAgg._sum.quantity || 0),
            wastageEvents: wastageAgg._count.id,
            topProducts: topProductsWithNames
        };
    }

    /**
     * Daily P&L Report:
     * Net Profit = Sales - (Purchase Cost + Wastage Cost + Staff/Store Expenses)
     */
    static async getPnL(locationId?: string, startDate?: Date, endDate?: Date) {
        const start = startDate ? new Date(startDate) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date(start);
        end.setHours(23, 59, 59, 999);

        // 1. Sales Revenue
        const salesAgg = await prisma.order.aggregate({
            where: {
                status: { in: ["DELIVERED", "CONFIRMED"] },
                createdAt: { gte: start, lte: end },
                ...(locationId && {
                    shift: { locationId } // Filter by location of the shift
                })
            },
            _sum: { totalAmount: true }
        });

        // 2. Cost of Goods Sold (COGS) — using Purchase rates
        const cogsAgg = await prisma.ledgerEntry.aggregate({
            where: {
                journal: {
                    date: { gte: start, lte: end },
                    reference: { startsWith: "ORDER_" },
                    ...(locationId && { locationId })
                },
                account: { code: "COA_COGS" }
            },
            _sum: { debit: true }
        });

        // 3. Natural Loss (Wastage Cost)
        const wastageAgg = await prisma.ledgerEntry.aggregate({
            where: {
                journal: {
                    date: { gte: start, lte: end },
                    reference: { startsWith: "MORTALITY_" },
                    ...(locationId && { locationId })
                },
                account: { code: "COA_NATURAL_LOSS" }
            },
            _sum: { debit: true }
        });

        // 4. Store Expenses (Salary, Utilities, Rent, etc.)
        const expensesAgg = await prisma.storeExpense.aggregate({
            where: {
                date: { gte: start, lte: end },
                ...(locationId && { locationId })
            },
            _sum: { amount: true }
        });

        const totalSales = Number(salesAgg._sum.totalAmount || 0);
        const purchaseCost = Number(cogsAgg._sum.debit || 0);
        const wastageCost = Number(wastageAgg._sum.debit || 0);
        const otherExpenses = Number(expensesAgg._sum.amount || 0);

        const totalExpenses = purchaseCost + wastageCost + otherExpenses;
        const netProfit = totalSales - totalExpenses;
        const margin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : "0";

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
            locationId: locationId || "ALL_STORES",
            totalSales,
            purchaseCost,
            wastageCost,
            otherExpenses,
            totalExpenses,
            netProfit,
            marginPercent: `${margin}%`
        };
    }

    /**
     * Staff packing leaderboard (based on StaffPerformanceLog).
     */
    static async getLeaderboard(from?: Date, to?: Date) {
        const start = from || (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })();
        const end = to || new Date();

        const perf = await prisma.staffPerformanceLog.groupBy({
            by: ["staffId"],
            where: { date: { gte: start, lte: end } },
            _sum: { ordersPackaged: true, errorCount: true },
            _avg: { avgPackTimeMin: true },
            orderBy: { _sum: { ordersPackaged: "desc" } }
        });

        const withNames = await Promise.all(
            perf.map(async (p, idx) => {
                const user = await prisma.user.findUnique({
                    where: { id: p.staffId },
                    select: { id: true, name: true }
                });
                const accuracy = p._sum.errorCount && p._sum.ordersPackaged
                    ? ((1 - p._sum.errorCount / p._sum.ordersPackaged) * 100).toFixed(1)
                    : "100.0";
                return {
                    rank: idx + 1,
                    staff: user,
                    ordersPackaged: p._sum.ordersPackaged,
                    errorCount: p._sum.errorCount,
                    avgPackTimeMin: Number(p._avg.avgPackTimeMin || 0).toFixed(1),
                    accuracyPercent: `${accuracy}%`
                };
            })
        );

        return withNames;
    }

    /**
     * Log a staff performance entry (called when order is packed).
     */
    static async logPackingPerformance(staffId: string, packTimeMin: number, hasError = false) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.staffPerformanceLog.upsert({
            where: { staffId_date: { staffId, date: today } },
            update: {
                ordersPackaged: { increment: 1 },
                errorCount: { increment: hasError ? 1 : 0 },
                avgPackTimeMin: packTimeMin
            },
            create: {
                staffId,
                date: today,
                ordersPackaged: 1,
                errorCount: hasError ? 1 : 0,
                avgPackTimeMin: new Prisma.Decimal(packTimeMin)
            }
        });
    }

    /**
     * Consolidates inventory across ALL stores.
     * Highlights low stock products.
     */
    static async getGlobalInventoryStatus() {
        const inventories = await prisma.inventory.findMany({
            include: {
                product: { select: { name: true, sku: true } },
                location: { select: { name: true } }
            },
            orderBy: { currentStock: 'asc' }
        });

        const lowStock = inventories.filter(inv => inv.currentStock <= inv.thresholdStock);

        return {
            totalItemsTracked: inventories.length,
            lowStockCount: lowStock.length,
            lowStockAlerts: lowStock.map(inv => ({
                store: inv.location.name,
                product: inv.product.name,
                sku: inv.product.sku,
                stock: inv.currentStock,
                threshold: inv.thresholdStock
            })),
            allInventory: inventories.map(inv => ({
                id: inv.id,
                store: inv.location.name,
                product: inv.product.name,
                sku: inv.product.sku,
                stock: inv.currentStock,
                threshold: inv.thresholdStock,
                isLowStock: inv.currentStock <= inv.thresholdStock
            }))
        };
    }

    /**
     * Aggregates store expenses globally
     */
    static async getGlobalCosts(startDate?: Date, endDate?: Date) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
        const end = endDate ? new Date(endDate) : new Date(new Date().setHours(23, 59, 59, 999));

        const expenses = await prisma.storeExpense.findMany({
            where: { date: { gte: start, lte: end } },
            include: { location: { select: { name: true } } },
            orderBy: { date: 'desc' }
        });

        const totalCost = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

        const costsByStore = expenses.reduce((acc: any, exp) => {
            const storeName = exp.location.name;
            if (!acc[storeName]) acc[storeName] = 0;
            acc[storeName] += Number(exp.amount);
            return acc;
        }, {});

        return {
            totalCost,
            costsByStore: Object.entries(costsByStore).map(([store, amount]) => ({ store, amount })),
            recentExpenses: expenses.slice(0, 10).map(e => ({
                id: e.id,
                store: e.location.name,
                category: e.category,
                amount: Number(e.amount),
                description: e.description,
                date: e.date
            }))
        };
    }

    /**
     * Comparative sales report per store (Online vs Offline + Cash vs UPI).
     */
    static async getGlobalSalesReport(startDate?: Date, endDate?: Date) {
        const start = startDate ? new Date(startDate) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date(start);
        end.setHours(23, 59, 59, 999);

        const locations = await prisma.location.findMany();
        const report = [];

        for (const loc of locations) {
            // WEB channel sales (purely online)
            const onlineSales = await prisma.order.aggregate({
                where: {
                    shift: { locationId: loc.id },
                    channel: "WEB",
                    status: "DELIVERED",
                    createdAt: { gte: start, lte: end }
                },
                _sum: { totalAmount: true }
            });

            // POS cash sales
            const posCashSales = await prisma.order.aggregate({
                where: {
                    shift: { locationId: loc.id },
                    channel: "POS",
                    status: "DELIVERED",
                    createdAt: { gte: start, lte: end },
                    payments: { some: { method: "CASH" } }
                },
                _sum: { totalAmount: true }
            });

            // POS online/UPI sales
            const posOnlineSales = await prisma.order.aggregate({
                where: {
                    shift: { locationId: loc.id },
                    channel: "POS",
                    status: "DELIVERED",
                    createdAt: { gte: start, lte: end },
                    payments: { some: { method: { not: "CASH" } } }
                },
                _sum: { totalAmount: true }
            });

            report.push({
                store: loc.name,
                online: Number(onlineSales._sum.totalAmount || 0),
                posCash: Number(posCashSales._sum.totalAmount || 0),
                posOnline: Number(posOnlineSales._sum.totalAmount || 0),
                total: Number(onlineSales._sum.totalAmount || 0) +
                    Number(posCashSales._sum.totalAmount || 0) +
                    Number(posOnlineSales._sum.totalAmount || 0)
            });
        }

        return report;
    }

    /**
     * Khata (Credit) oversight for Super Admin.
     */
    static async getKhataOversight() {
        const khatas = await prisma.customerKhata.findMany({
            include: { user: { select: { name: true, phone: true } } },
            orderBy: { outstanding: "desc" }
        });

        const totalOutstanding = khatas.reduce((acc, k) => acc + Number(k.outstanding), 0);
        const highRisk = khatas.filter(k =>
            Number(k.outstanding) > (Number(k.creditLimit) * 0.8)
        );

        return {
            stats: {
                totalOutstanding,
                highRiskCount: highRisk.length,
                totalKhataUsers: khatas.length
            },
            highRiskUsers: highRisk.map(k => ({
                name: k.user.name,
                phone: k.user.phone,
                limit: Number(k.creditLimit),
                outstanding: Number(k.outstanding)
            }))
        };
    }
}

export class WhatsAppBotService {
    /**
     * Sends morning stock summary to owner/manager.
     * Calls the existing /api/v1/whatsapp endpoint.
     */
    static async sendMorningStock(locationId: string, recipientPhone: string) {
        const inventories = await prisma.inventory.findMany({
            where: { locationId },
            include: { product: { select: { name: true } } },
            orderBy: { currentStock: "asc" },
            take: 20
        });

        const lines = inventories.map(inv =>
            `${inv.product.name}: ${inv.currentStock} ${inv.product ? "" : ""}`
        );

        const message = `🌅 *Morning Stock Report*\n📅 ${new Date().toLocaleDateString("en-IN")}\n\n${lines.join("\n")}\n\n_Low stock items shown first._`;
        return { recipient: recipientPhone, message, type: "MORNING_STOCK" };
    }

    /**
     * Sends bill (as text summary) to customer via WhatsApp.
     */
    static async sendBill(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { name: true, phone: true } },
                items: {
                    include: { product: { select: { name: true } } }
                }
            }
        });

        if (!order) throw new Error("Order not found.");

        const itemLines = (order.items as any[]).map(
            (item: any) => `• ${item.product.name} × ${item.quantity} = ₹${Number(item.price) * item.quantity}`
        );

        const message = `🧾 *Bill for Order #${order.id.slice(-8).toUpperCase()}*\n\n${itemLines.join("\n")}\n\n*Total: ₹${order.totalAmount}*\n\nThank you for shopping with us! 🙏`;

        return {
            recipient: (order.user as any)?.phone,
            message,
            type: "BILL",
            orderId
        };
    }

    /**
     * Sends evening sale summary to owner.
     */
    static async sendEveningSummary(locationId: string, recipientPhone: string) {
        const dashboard = await (await import("./analyticsService")).AnalyticsService.getDashboard(locationId);
        const message = `📊 *Evening Sales Summary*\n📅 ${dashboard.date}\n\n💰 Sales: ₹${dashboard.totalSales}\n📦 Orders: ${dashboard.totalOrders}\n⚖️ Weight Sold: ${dashboard.weightSoldKg} kg\n🗑️ Wastage: ${dashboard.wastagePieces} units\n\nTop Product: ${dashboard.topProducts[0]?.product?.name || "—"}`;
        return { recipient: recipientPhone, message, type: "EVENING_SUMMARY" };
    }

    /**
     * Sends refund alert to customer.
     */
    static async sendRefundAlert(orderId: string, refundAmount: number) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { user: { select: { name: true, phone: true } } }
        });
        if (!order) throw new Error("Order not found.");

        const message = `🔄 *Refund Alert*\nHi ${(order.user as any)?.name || "Customer"},\n\nYour refund of *₹${refundAmount}* for Order #${order.id.slice(-8).toUpperCase()} has been processed.\n\nExpected in 2-3 business days. 🙏`;

        return {
            recipient: (order.user as any)?.phone,
            message,
            type: "REFUND_ALERT",
            orderId
        };
    }
}
