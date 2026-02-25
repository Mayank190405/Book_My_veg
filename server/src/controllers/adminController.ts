import { Request, Response } from "express";
import prisma from "../config/prisma";

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const [totalUsers, totalOrders, totalProducts, totalSales, lowStockProducts] = await Promise.all([
            prisma.user.count(),
            prisma.order.count(),
            prisma.product.count(),
            prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: { status: { not: "CANCELLED" } }
            }),
            prisma.product.findMany({
                where: {
                    inventory: {
                        some: {
                            currentStock: { lte: 5 }
                        }
                    }
                },
                include: { inventory: true },
                take: 5
            })
        ]);

        const recentOrders = await prisma.order.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { name: true, phone: true } }
            }
        });

        res.json({
            stats: {
                users: totalUsers,
                orders: totalOrders,
                products: totalProducts,
                revenue: totalSales._sum.totalAmount || 0
            },
            recentOrders,
            lowStockProducts
        });
    } catch (error) {
        console.error("[AdminStats] error:", error);
        res.status(500).json({ message: "Error fetching admin stats" });
    }
};
