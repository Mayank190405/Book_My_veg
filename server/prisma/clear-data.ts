import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Cleaning all dummy data...");

    // Ordered deletions to avoid foreign key constraints
    const p = prisma as any;
    await p.driverAssignment.deleteMany();
    await p.deliveryOTP.deleteMany();
    await p.deliveryAsset.deleteMany();
    await p.driverCashLedger.deleteMany();
    await p.staffPerformanceLog.deleteMany();
    await p.ledgerEntry.deleteMany();
    await p.journalEntry.deleteMany();
    await p.periodLock.deleteMany();
    await p.mortalityLog.deleteMany();
    await p.inventoryLog.deleteMany();
    await p.inventory.deleteMany();
    await p.pricing.deleteMany();
    await p.sectionProduct.deleteMany();
    await p.suspendedOrderItem.deleteMany();
    await p.suspendedOrder.deleteMany();
    await p.orderItem.deleteMany();
    await p.orderStatusHistory.deleteMany();
    await p.payment.deleteMany();
    await p.order.deleteMany();
    await p.cartItem.deleteMany();
    await p.cart.deleteMany();
    await p.review.deleteMany();
    await p.searchHistory.deleteMany();
    await p.coupon.deleteMany();
    await p.address.deleteMany();
    await p.banner.deleteMany();
    await p.productVariant.deleteMany();
    await p.product.deleteMany();
    await p.category.deleteMany();
    await p.location.deleteMany();
    await p.mandiRate.deleteMany();
    await p.stockTransfer.deleteMany();
    await p.customerKhata.deleteMany();
    await p.cashierShift.deleteMany();
    await prisma.user.deleteMany({
        where: {
            role: { not: "ADMIN" } // Optional: Keep admin users? Let's just clear everything for complete clean start.
        }
    });

    console.log("✅ Database cleared successfully.");
}

main()
    .catch((e) => {
        console.error("Error clearing data:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
