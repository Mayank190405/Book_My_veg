
import { Request, Response } from "express";
import prisma from "../config/prisma";

export const markAttendance = async (req: Request, res: Response) => {
    const { userId, locationId, status } = req.body;
    try {
        const attendance = await prisma.attendance.create({
            data: {
                userId,
                locationId,
                status: status || "PRESENT"
            }
        });
        res.json(attendance);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getStoreAttendance = async (req: Request, res: Response) => {
    const { locationId } = req.params;
    const { date } = req.query; // YYYY-MM-DD
    try {
        const start = date ? new Date(date as string) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);

        const attendance = await prisma.attendance.findMany({
            where: {
                locationId: locationId as string,
                checkIn: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                user: {
                    select: { name: true, phone: true }
                }
            }
        });
        res.json(attendance);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getUserAttendance = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const attendance = await prisma.attendance.findMany({
            where: { userId: userId as string },
            orderBy: { checkIn: "desc" },
            take: 31
        });
        res.json(attendance);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
