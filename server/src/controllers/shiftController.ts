import { Request, Response } from "express";
import prisma from "../config/prisma";

export const openShift = async (req: Request, res: Response) => {
    const { userId, openingBalance } = req.body;
    try {
        const activeShift = await (prisma as any).cashierShift.findFirst({
            where: { userId, status: "OPEN" }
        });

        if (activeShift) {
            return res.status(400).json({ message: "You already have an open shift" });
        }

        const shift = await (prisma as any).cashierShift.create({
            data: {
                userId,
                openingBalance: openingBalance || 0,
                status: "OPEN"
            }
        });

        res.status(201).json(shift);
    } catch (error) {
        console.error("[POS Shift] Error opening shift:", error);
        res.status(500).json({ message: "Error opening shift" });
    }
};

export const closeShift = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { closingBalance } = req.body;
    try {
        const shift = await (prisma as any).cashierShift.findUnique({
            where: { id: id as string },
            include: { orders: true }
        });

        if (!shift) return res.status(404).json({ message: "Shift not found" });

        const totalSales = (shift as any).orders.reduce((acc: number, order: any) => acc + Number(order.totalAmount), 0);

        const updatedShift = await (prisma as any).cashierShift.update({
            where: { id: id as string },
            data: {
                endTime: new Date(),
                status: "CLOSED",
                closingBalance: closingBalance || 0,
                totalSales
            }
        });

        res.json(updatedShift);
    } catch (error) {
        console.error("[POS Shift] Error closing shift:", error);
        res.status(500).json({ message: "Error closing shift" });
    }
};

export const getShiftStatus = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const shift = await (prisma as any).cashierShift.findFirst({
            where: { userId: userId as string, status: "OPEN" },
            include: {
                orders: {
                    select: { totalAmount: true }
                }
            }
        });
        res.json(shift || { status: "CLOSED" });
    } catch (error) {
        res.status(500).json({ message: "Error fetching shift status" });
    }
};
