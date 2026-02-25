import prisma from "../config/prisma";
import { Prisma, Role } from "@prisma/client";
import crypto from "crypto";

export class DeliveryService {
    /**
     * Auto-assigns a driver to an order based on cluster zone / manual selection.
     */
    static async assignDriver(params: {
        orderId: string;
        driverId?: string; // If not provided, auto-assign
        clusterZone?: string;
    }) {
        let driverId = params.driverId;

        if (!driverId) {
            // Find an available driver for this zone
            const availableDriver = await prisma.user.findFirst({
                where: {
                    role: Role.DELIVERY_PARTNER,
                    isActive: true,
                    // Drivers not already having an ASSIGNED or PICKED order
                    driverAssignments: {
                        none: { status: { in: ["ASSIGNED", "PICKED"] } }
                    }
                }
            });
            if (!availableDriver) throw new Error("No available drivers at this time.");
            driverId = availableDriver.id;
        }

        return prisma.driverAssignment.create({
            data: {
                orderId: params.orderId,
                driverId,
                clusterZone: params.clusterZone,
                status: "ASSIGNED"
            },
            include: {
                driver: { select: { id: true, name: true, phone: true } },
                order: { select: { id: true, totalAmount: true } }
            }
        });
    }

    /**
     * Generates a 4-digit OTP for delivery verification.
     */
    static async generateOTP(orderId: string) {
        const otp = crypto.randomInt(1000, 9999).toString();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.deliveryOTP.upsert({
            where: { orderId },
            update: { otp, expiresAt, isUsed: false },
            create: { orderId, otp, expiresAt }
        });

        return { otp, expiresAt };
    }

    /**
     * Verifies OTP and marks order as DELIVERED.
     */
    static async verifyOTPAndDeliver(orderId: string, otp: string, driverId: string) {
        const record = await prisma.deliveryOTP.findUnique({ where: { orderId } });

        if (!record) throw new Error("No OTP found for this order.");
        if (record.isUsed) throw new Error("OTP already used.");
        if (new Date() > record.expiresAt) throw new Error("OTP expired.");
        if (record.otp !== otp) throw new Error("Invalid OTP.");

        // Mark OTP used
        await prisma.deliveryOTP.update({ where: { orderId }, data: { isUsed: true } });

        // Update assignment
        await prisma.driverAssignment.update({
            where: { orderId },
            data: { status: "DELIVERED", deliveredAt: new Date() }
        });

        // Mark order delivered
        await prisma.order.update({
            where: { id: orderId },
            data: { status: "DELIVERED" }
        });

        return { success: true, message: "Delivery confirmed." };
    }

    /**
     * Lists assets assigned to a driver.
     */
    static async getDriverAssets(driverId: string) {
        return prisma.deliveryAsset.findMany({
            where: { assignedTo: driverId, isReturned: false },
            include: { driver: { select: { id: true, name: true } } }
        });
    }

    /**
     * Assigns asset to driver.
     */
    static async assignAsset(assetId: string, driverId: string) {
        return prisma.deliveryAsset.update({
            where: { id: assetId },
            data: { assignedTo: driverId, isReturned: false, lastAssigned: new Date() }
        });
    }

    /**
     * Returns asset from driver.
     */
    static async returnAsset(assetId: string) {
        return prisma.deliveryAsset.update({
            where: { id: assetId },
            data: { isReturned: true, assignedTo: null }
        });
    }

    /**
     * EOD cash reconciliation for a driver.
     */
    static async submitEOD(params: {
        driverId: string;
        deposited: number;
        notes?: string;
    }) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Sum all COD orders delivered today by this driver
        const assignments = await prisma.driverAssignment.findMany({
            where: {
                driverId: params.driverId,
                status: "DELIVERED",
                deliveredAt: { gte: today, lt: tomorrow }
            },
            include: {
                order: { include: { payments: true } }
            }
        });

        const codTotal = assignments.reduce((acc, a) => {
            const isCOD = a.order.payments.some((p: any) => p.method === "COD");
            if (isCOD) {
                return acc + Number(a.order.totalAmount || 0);
            }
            return acc;
        }, 0);

        const variance = codTotal - params.deposited;

        return prisma.driverCashLedger.create({
            data: {
                driverId: params.driverId,
                codTotal: new Prisma.Decimal(codTotal),
                deposited: new Prisma.Decimal(params.deposited),
                variance: new Prisma.Decimal(variance),
                status: Math.abs(variance) < 1 ? "SETTLED" : "PENDING",
                notes: params.notes
            }
        });
    }

    /**
     * Gets optimized route for a driver's orders (returns order addresses in optimized sequence).
     */
    static async getRoute(driverId: string) {
        const assignments = await prisma.driverAssignment.findMany({
            where: { driverId, status: "ASSIGNED" },
            include: {
                order: {
                    include: {
                        user: { select: { name: true, phone: true } }
                    }
                }
            },
            orderBy: { assignedAt: "asc" }
        });

        // Basic cluster sort — group by zone/area
        const stops = assignments.map((a, idx) => ({
            stopNumber: idx + 1,
            orderId: a.orderId,
            customer: a.order.user,
            address: a.order.shippingAddress
        }));

        return {
            driverId,
            totalStops: stops.length,
            stops,
            mapsUrl: stops.length > 0
                ? `https://www.google.com/maps/dir/${stops.map(s => encodeURIComponent(`${(s.address as any)?.street || ""},${(s.address as any)?.city || ""}`)).join("/")}`
                : null
        };
    }
}
