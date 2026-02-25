import prisma from "../config/prisma";

export const packerService = {
    /**
     * Get orders assigned to a packer.
     */
    async getAssignedOrders(packerId: string) {
        return await prisma.order.findMany({
            where: {
                packerId,
                status: { in: ["CONFIRMED", "PROCESSING"] }
            },
            include: {
                items: {
                    include: { product: true }
                },
                user: true
            },
            orderBy: { createdAt: "asc" }
        });
    },

    /**
     * Complete packing for an order.
     */
    async completePacking(orderId: string, data: {
        verificationPhoto: string;
        packerNotes?: string;
        startTime?: Date;
        adjustments?: Array<{
            productId: string;
            variantId?: string;
            reason: "DAMAGED" | "OUT_OF_STOCK" | "QUALITY_ISSUE";
            quantity: number;
        }>;
    }) {
        return await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { shift: true }
            });

            if (!order) throw new Error("Order not found");

            // 1. Record adjustments as mortality if needed
            if (data.adjustments && data.adjustments.length > 0) {
                for (const adj of data.adjustments) {
                    await tx.mortalityLog.create({
                        data: {
                            productId: adj.productId,
                            variantId: adj.variantId,
                            locationId: order.shift?.locationId || "",
                            quantity: adj.quantity,
                            reason: adj.reason === "OUT_OF_STOCK" ? "QUALITY_ISSUE" : adj.reason as any,
                            notes: `Packer Adjustment: ${adj.reason} for order ${orderId}`
                        }
                    });

                    // Automated stock-out trigger: If adjustment is OUT_OF_STOCK, mark product as not published
                    if (adj.reason === "OUT_OF_STOCK") {
                        await tx.product.update({
                            where: { id: adj.productId },
                            data: { isWebsitePublished: false }
                        });
                    }
                }
            }

            // 2. Performance Tracking
            if (data.startTime && order.packerId) {
                const now = new Date();
                const timeTakenMin = (now.getTime() - new Date(data.startTime).getTime()) / (1000 * 60);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const existingLog = await tx.staffPerformanceLog.findUnique({
                    where: { staffId_date: { staffId: order.packerId, date: today } }
                });

                if (existingLog) {
                    const totalPackTime = (Number(existingLog.avgPackTimeMin) * existingLog.ordersPackaged) + timeTakenMin;
                    const newOrderCount = existingLog.ordersPackaged + 1;

                    await tx.staffPerformanceLog.update({
                        where: { id: existingLog.id },
                        data: {
                            ordersPackaged: newOrderCount,
                            errorCount: { increment: data.adjustments?.length || 0 },
                            avgPackTimeMin: totalPackTime / newOrderCount
                        }
                    });
                } else {
                    await tx.staffPerformanceLog.create({
                        data: {
                            staffId: order.packerId,
                            date: today,
                            ordersPackaged: 1,
                            errorCount: data.adjustments?.length || 0,
                            avgPackTimeMin: timeTakenMin
                        }
                    });
                }
            }

            // 3. Update order status
            return await tx.order.update({
                where: { id: orderId },
                data: {
                    status: "PACKED",
                    packedAt: new Date(),
                    verificationPhoto: data.verificationPhoto,
                    packerNotes: data.packerNotes ? JSON.stringify(data.packerNotes) : undefined
                }
            });
        });
    }
};
