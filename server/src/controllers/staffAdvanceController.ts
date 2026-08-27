import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { Prisma } from "@prisma/client";

export const getStaffAdvances = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { locationId, staffId, month, year } = req.query;
    try {
        const whereClause: any = {};

        if (staffId && staffId !== "ALL") {
            whereClause.staffId = String(staffId);
        }

        if (locationId && locationId !== "ALL") {
            whereClause.OR = [
                { locationId: String(locationId) },
                { staff: { locationId: String(locationId) } }
            ];
        }

        if (month && month !== "ALL") {
            whereClause.month = Number(month);
        }

        if (year && year !== "ALL") {
            whereClause.year = Number(year);
        }

        const advances = await prisma.staffAdvance.findMany({
            where: whereClause,
            include: {
                staff: { select: { id: true, name: true, phone: true, role: true, baseSalary: true, locationId: true } },
                approvedBy: { select: { id: true, name: true, role: true } },
                location: { select: { id: true, name: true } }
            },
            orderBy: { date: "desc" }
        });

        const totalAdvanceAmount = advances.reduce((acc, a) => acc + Number(a.amount), 0);

        res.json({ advances, totalAdvanceAmount });
    } catch (error) {
        next(error);
    }
};

export const createStaffAdvance = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { staffId, amount, date, paymentMethod, notes, month, year, locationId } = req.body;
    const approverId = req.user?.userId;

    if (!staffId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ message: "Staff member and a positive advance amount are required." });
    }

    try {
        const advanceDate = date ? new Date(date) : new Date();
        const advMonth = month ? Number(month) : (advanceDate.getMonth() + 1);
        const advYear = year ? Number(year) : advanceDate.getFullYear();

        const staffUser = await prisma.user.findUnique({
            where: { id: String(staffId) },
            select: { locationId: true }
        });

        const targetLocationId = locationId || staffUser?.locationId || req.user?.locationId || null;

        const advance = await prisma.staffAdvance.create({
            data: {
                staffId: String(staffId),
                amount: new Prisma.Decimal(amount),
                date: advanceDate,
                month: advMonth,
                year: advYear,
                paymentMethod: paymentMethod || "CASH",
                status: "PAID",
                notes: notes || null,
                approvedById: approverId || null,
                locationId: targetLocationId
            },
            include: {
                staff: { select: { id: true, name: true, phone: true } },
                approvedBy: { select: { id: true, name: true } }
            }
        });

        res.status(201).json({ message: "Staff salary advance recorded successfully.", advance });
    } catch (error) {
        next(error);
    }
};

export const updateStaffAdvance = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, notes, amount, paymentMethod } = req.body;

    try {
        const advance = await prisma.staffAdvance.update({
            where: { id: String(id) },
            data: {
                ...(status && { status: String(status) }),
                ...(notes !== undefined && { notes }),
                ...(amount && { amount: new Prisma.Decimal(amount) }),
                ...(paymentMethod && { paymentMethod })
            },
            include: {
                staff: { select: { id: true, name: true, phone: true } }
            }
        });

        res.json({ message: "Salary advance updated successfully.", advance });
    } catch (error) {
        next(error);
    }
};

export const deleteStaffAdvance = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        await prisma.staffAdvance.delete({ where: { id: String(id) } });
        res.json({ message: "Salary advance deleted successfully." });
    } catch (error) {
        next(error);
    }
};
