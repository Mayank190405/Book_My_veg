import dotenv from "dotenv";
dotenv.config();
import prisma from "../config/prisma";
import logger from "../utils/logger";

async function main() {
    console.log("🧹 Starting duplicate payments database cleanup...");

    // 1. Group payments by orderId with count > 1
    const duplicateOrders = await prisma.payment.groupBy({
        by: ["orderId"],
        where: { status: "SUCCESS" },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } }
    });

    console.log(`Found ${duplicateOrders.length} orders with multiple payment records.`);

    let totalDeleted = 0;

    for (const item of duplicateOrders) {
        const orderId = item.orderId;
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) continue;

        const payments = await prisma.payment.findMany({
            where: { orderId, status: "SUCCESS" },
            orderBy: { createdAt: "asc" }
        });

        const orderTotal = Number(order.totalAmount);
        let accum = 0;
        const duplicateIds: string[] = [];

        for (const p of payments) {
            const amt = Number(p.amount);
            // If accumulated paid amount already covers or exceeds orderTotal, mark subsequent payments as duplicate
            if (accum >= orderTotal) {
                duplicateIds.push(p.id);
            } else {
                accum += amt;
            }
        }

        if (duplicateIds.length > 0) {
            console.log(`Deleting ${duplicateIds.length} duplicate payments for order ${orderId} (Original Total: ₹${orderTotal})...`);
            await prisma.payment.deleteMany({
                where: { id: { in: duplicateIds } }
            });
            totalDeleted += duplicateIds.length;

            // Recalculate order paid status
            const remainingPayments = await prisma.payment.findMany({
                where: { orderId, status: "SUCCESS" }
            });
            const newTotalPaid = remainingPayments.reduce((acc, p) => acc + Number(p.amount), 0);
            const isFull = newTotalPaid >= orderTotal;

            await prisma.order.update({
                where: { id: orderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: isFull ? "COMPLETED" : (newTotalPaid > 0 ? "PARTIAL" : "PENDING")
                }
            });
        }
    }

    console.log(`✅ Cleanup complete! Removed ${totalDeleted} duplicate payment records.`);
    process.exit(0);
}

main().catch(err => {
    console.error("Cleanup Error:", err);
    process.exit(1);
});
