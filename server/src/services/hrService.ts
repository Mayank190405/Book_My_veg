import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

export const hrService = {
    /**
     * Check-in a user at a location.
     */
    async checkIn(userId: string, locationId: string) {
        // Check if already checked in today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existing = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: today },
                checkOut: null
            }
        });

        if (existing) throw new Error("Already checked in");

        return await prisma.attendance.create({
            data: {
                userId,
                locationId,
                status: "PRESENT"
            }
        });
    },

    /**
     * Check-out a user.
     */
    async checkOut(attendanceId: string) {
        return await prisma.attendance.update({
            where: { id: attendanceId },
            data: { checkOut: new Date() }
        });
    },

    /**
     * Record a salary payment.
     */
    async recordSalaryPayment(data: {
        userId: string;
        amount: number;
        periodStart: Date;
        periodEnd: Date;
        notes?: string;
    }) {
        return await prisma.$transaction(async (tx) => {
            const payment = await tx.salaryPayment.create({
                data: {
                    userId: data.userId,
                    amount: new Prisma.Decimal(data.amount),
                    periodStart: data.periodStart,
                    periodEnd: data.periodEnd,
                    notes: data.notes
                }
            });

            // Also record as a STORE expense if linked to a primary location
            // For now, we'll let the controller handle location mapping.
            return payment;
        });
    },

    async getAttendance(userId: string, startDate: Date, endDate: Date) {
        return await prisma.attendance.findMany({
            where: {
                userId,
                checkIn: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: { location: true },
            orderBy: { checkIn: "desc" }
        });
    },

    async getAllStaff(locationId?: string) {
        return await prisma.user.findMany({
            where: {
                role: { in: ["ADMIN", "MANAGER", "POS_OPERATOR", "PACKING", "DELIVERY_PARTNER", "CENTER_HEAD", "STORE_ADMIN"] },
                ...(locationId && { locationId })
            },
            include: {
                location: true,
                attendances: { take: 1, orderBy: { checkIn: "desc" } }
            }
        });
    },

    async updateStaff(userId: string, data: {
        name?: string;
        salary?: number;
        joiningDate?: Date;
        leavingDate?: Date;
        profileAddress?: string;
        locationId?: string;
        role?: any;
        isActive?: boolean;
    }) {
        return await (prisma.user as any).update({
            where: { id: userId },
            data: {
                ...data,
                salary: data.salary ? new Prisma.Decimal(data.salary) : undefined
            }
        });
    }
};
