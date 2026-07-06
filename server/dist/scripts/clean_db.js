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
function cleanDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🚀 Starting database cleanup...");
        try {
            // 1. Transactional deletion in reverse dependency order
            yield prisma.$transaction([
                // Logs and Settlements
                prisma.inventoryLog.deleteMany(),
                prisma.transaction.deleteMany(),
                prisma.cartItem.deleteMany(),
                // Batch and Inventory
                prisma.batch.deleteMany(),
                prisma.inventory.deleteMany(),
                // Orders and Payments
                prisma.orderItem.deleteMany(),
                prisma.payment.deleteMany(),
                prisma.order.deleteMany(),
                // Product Catalog
                prisma.productVariant.deleteMany(),
                prisma.product.deleteMany(),
                // Optional: Category if needed? 
                // User says products, bills, inventory.
            ]);
            console.log("✅ Database cleanup successful! Products, Bills, and Inventory have been wiped.");
        }
        catch (error) {
            console.error("❌ Cleanup failed:", error);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
cleanDatabase();
