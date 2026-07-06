"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🧹 Cleaning all dummy data...");
        // Ordered deletions to avoid foreign key constraints
        const p = prisma;
        yield p.driverAssignment.deleteMany();
        yield p.deliveryOTP.deleteMany();
        yield p.deliveryAsset.deleteMany();
        yield p.driverCashLedger.deleteMany();
        yield p.staffPerformanceLog.deleteMany();
        yield p.ledgerEntry.deleteMany();
        yield p.journalEntry.deleteMany();
        yield p.periodLock.deleteMany();
        yield p.mortalityLog.deleteMany();
        yield p.inventoryLog.deleteMany();
        yield p.inventory.deleteMany();
        yield p.pricing.deleteMany();
        yield p.sectionProduct.deleteMany();
        yield p.suspendedOrderItem.deleteMany();
        yield p.suspendedOrder.deleteMany();
        yield p.orderItem.deleteMany();
        yield p.orderStatusHistory.deleteMany();
        yield p.payment.deleteMany();
        yield p.order.deleteMany();
        yield p.cartItem.deleteMany();
        yield p.cart.deleteMany();
        yield p.review.deleteMany();
        yield p.searchHistory.deleteMany();
        yield p.coupon.deleteMany();
        yield p.address.deleteMany();
        yield p.banner.deleteMany();
        yield p.productVariant.deleteMany();
        yield p.product.deleteMany();
        yield p.category.deleteMany();
        yield p.location.deleteMany();
        yield p.mandiRate.deleteMany();
        yield p.stockTransfer.deleteMany();
        yield p.customerKhata.deleteMany();
        yield p.cashierShift.deleteMany();
        yield prisma.user.deleteMany({
            where: {
                role: { not: "ADMIN" } // Optional: Keep admin users? Let's just clear everything for complete clean start.
            }
        });
        console.log("✅ Database cleared successfully.");
    });
}
main()
    .catch((e) => {
    console.error("Error clearing data:", e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
