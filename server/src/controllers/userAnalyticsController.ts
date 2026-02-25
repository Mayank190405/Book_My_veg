import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

export const getCustomerLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leaderboard = await prisma.user.findMany({
            where: { role: "USER" },
            select: {
                id: true,
                name: true,
                phone: true,
                _count: {
                    select: { orders: true }
                },
                orders: {
                    select: {
                        totalAmount: true,
                        channel: true,
                        shift: {
                            select: {
                                location: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                }
            },
            take: 20
        });

        const formatted = leaderboard.map(user => {
            const totalSpent = user.orders.reduce((acc, ord) => acc + Number(ord.totalAmount), 0);
            const onlineSpend = user.orders.filter(o => o.channel === "WEB").reduce((acc, ord) => acc + Number(ord.totalAmount), 0);
            const offlineSpend = user.orders.filter(o => o.channel === "POS").reduce((acc, ord) => acc + Number(ord.totalAmount), 0);

            const storeCounts: Record<string, number> = {};
            let mostRepeatStore = "N/A";
            let maxCount = 0;

            user.orders.forEach(o => {
                const storeName = o.shift?.location?.name;
                if (storeName) {
                    storeCounts[storeName] = (storeCounts[storeName] || 0) + 1;
                    if (storeCounts[storeName] > maxCount) {
                        maxCount = storeCounts[storeName];
                        mostRepeatStore = storeName;
                    }
                }
            });

            return {
                id: user.id,
                name: user.name,
                phone: user.phone,
                orderCount: user._count.orders,
                totalSpent,
                onlineSpend,
                offlineSpend,
                mostRepeatStore
            };
        }).sort((a, b) => b.totalSpent - a.totalSpent);

        res.json(formatted);
    } catch (error) {
        next(error);
    }
};

export const getKhataOversight = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const khataData = await prisma.customerKhata.findMany({
            include: {
                user: {
                    select: { name: true, phone: true }
                }
            }
        });

        const stats = {
            totalOutstanding: khataData.reduce((acc, k) => acc + Number(k.outstanding), 0),
            totalCustomers: khataData.length,
            highRiskCount: khataData.filter(k => Number(k.outstanding) > Number(k.creditLimit) * 0.8).length
        };

        res.json({ stats, customers: khataData });
    } catch (error) {
        next(error);
    }
};

export const createOperationalUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, phone, role, locationId, password } = req.body;
        // In reality, hash password here
        const user = await prisma.user.create({
            data: {
                name,
                phone,
                role,
                locationId,
                password // SHOULD BE HASHED
            }
        });
        res.status(201).json(user);
    } catch (error: any) {
        console.error("[Create Staff Error]:", error?.message || error);
        console.log("Payload was:", JSON.stringify(req.body));
        next(error);
    }
};
