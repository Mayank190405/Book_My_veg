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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = __importDefault(require("../config/prisma"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🧹 Starting duplicate payments database cleanup...");
        // 1. Group payments by orderId with count > 1
        const duplicateOrders = yield prisma_1.default.payment.groupBy({
            by: ["orderId"],
            where: { status: "SUCCESS" },
            _count: { id: true },
            having: { id: { _count: { gt: 1 } } }
        });
        console.log(`Found ${duplicateOrders.length} orders with multiple payment records.`);
        let totalDeleted = 0;
        for (const item of duplicateOrders) {
            const orderId = item.orderId;
            const order = yield prisma_1.default.order.findUnique({ where: { id: orderId } });
            if (!order)
                continue;
            const payments = yield prisma_1.default.payment.findMany({
                where: { orderId, status: "SUCCESS" },
                orderBy: { createdAt: "asc" }
            });
            const orderTotal = Number(order.totalAmount);
            let accum = 0;
            const duplicateIds = [];
            for (const p of payments) {
                const amt = Number(p.amount);
                // If accumulated paid amount already covers or exceeds orderTotal, mark subsequent payments as duplicate
                if (accum >= orderTotal) {
                    duplicateIds.push(p.id);
                }
                else {
                    accum += amt;
                }
            }
            if (duplicateIds.length > 0) {
                console.log(`Deleting ${duplicateIds.length} duplicate payments for order ${orderId} (Original Total: ₹${orderTotal})...`);
                yield prisma_1.default.payment.deleteMany({
                    where: { id: { in: duplicateIds } }
                });
                totalDeleted += duplicateIds.length;
                // Recalculate order paid status
                const remainingPayments = yield prisma_1.default.payment.findMany({
                    where: { orderId, status: "SUCCESS" }
                });
                const newTotalPaid = remainingPayments.reduce((acc, p) => acc + Number(p.amount), 0);
                const isFull = newTotalPaid >= orderTotal;
                yield prisma_1.default.order.update({
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
    });
}
main().catch(err => {
    console.error("Cleanup Error:", err);
    process.exit(1);
});
