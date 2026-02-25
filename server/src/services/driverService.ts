import prisma from "../config/prisma";

export const driverService = {
    /**
     * Get orders assigned to a driver.
     */
    async getAssignedDeliveries(driverId: string) {
        return await prisma.driverAssignment.findMany({
            where: {
                driverId,
                status: { in: ["ASSIGNED", "PICKED"] }
            },
            include: {
                order: {
                    include: {
                        items: { include: { product: true } },
                        user: true
                    }
                }
            },
            orderBy: { assignedAt: "desc" }
        });
    },

    /**
     * Mark order as picked up by driver.
     */
    async pickUpOrder(assignmentId: string) {
        return await prisma.$transaction(async (tx) => {
            const assignment = await tx.driverAssignment.update({
                where: { id: assignmentId },
                data: { status: "PICKED" },
                include: { order: true }
            });

            await tx.order.update({
                where: { id: assignment.orderId },
                data: { status: "OUT_FOR_DELIVERY" }
            });

            // Create OTP for delivery
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await tx.deliveryOTP.upsert({
                where: { orderId: assignment.orderId },
                update: { otp, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), isUsed: false },
                create: {
                    orderId: assignment.orderId,
                    otp,
                    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
                }
            });

            return { assignment, otp }; // OTP would normally be sent via SMS
        });
    },

    /**
     * Complete delivery with OTP verification.
     */
    async completeDelivery(assignmentId: string, otp: string) {
        return await prisma.$transaction(async (tx) => {
            const assignment = await tx.driverAssignment.findUnique({
                where: { id: assignmentId },
                include: { order: { include: { deliveryOtp: true } } }
            });

            if (!assignment || !assignment.order.deliveryOtp) {
                throw new Error("Assignment or OTP not found");
            }

            if (assignment.order.deliveryOtp.otp !== otp || assignment.order.deliveryOtp.isUsed) {
                throw new Error("Invalid or expired OTP");
            }

            // Update OTP
            await tx.deliveryOTP.update({
                where: { orderId: assignment.orderId },
                data: { isUsed: true }
            });

            // Update Assignment
            await tx.driverAssignment.update({
                where: { id: assignmentId },
                data: {
                    status: "DELIVERED",
                    deliveredAt: new Date()
                }
            });

            // Update Order
            return await tx.order.update({
                where: { id: assignment.orderId },
                data: {
                    status: "DELIVERED",
                    paymentStatus: "PAID",
                    isPaid: true
                }
            });
        });
    },

    /**
     * Simulate HDFC Payment Link Generation
     */
    async generateHDFCLink(orderId: string) {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error("Order not found");

        // Simulate a secure HDFC gateway URL
        const mockLink = `https://hdfc.smart-gateway.bmv.com/pay?orderId=${orderId}&amt=${order.totalAmount}&token=${Math.random().toString(36).substring(7)}`;

        return {
            paymentLink: mockLink,
            orderId,
            amount: order.totalAmount,
            expiryIn: "15 minutes"
        };
    }
};
