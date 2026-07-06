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
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectionString = process.env.DATABASE_URL;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🚀 Starting Safe System Purge...");
        // 1. Identify Admins to preserve
        const admins = yield prisma.user.findMany({
            where: {
                role: { in: ["ADMIN", "STORE_ADMIN", "CENTER_HEAD"] }
            },
            select: { id: true, phone: true, name: true }
        });
        console.log(`🛡️ Preserving ${admins.length} Admin(s):`, admins.map(a => `${a.name} (${a.phone})`).join(", "));
        const adminIds = admins.map(a => a.id);
        // 2. Clear Transactional & Dependent Data (Order is important for FK constraints)
        console.log("🧹 Clearing transactions and logs...");
        yield prisma.orderStatusHistory.deleteMany({});
        yield prisma.payment.deleteMany({});
        yield prisma.orderItem.deleteMany({});
        yield prisma.order.deleteMany({});
        yield prisma.cartItem.deleteMany({});
        yield prisma.cart.deleteMany({});
        yield prisma.review.deleteMany({});
        yield prisma.searchHistory.deleteMany({});
        yield prisma.notification.deleteMany({});
        yield prisma.inventoryLog.deleteMany({});
        yield prisma.mortalityLog.deleteMany({});
        yield prisma.attendance.deleteMany({});
        yield prisma.cashierShift.deleteMany({});
        yield prisma.storeExpense.deleteMany({});
        yield prisma.auditLog.deleteMany({});
        yield prisma.securityAuditLog.deleteMany({});
        yield prisma.address.deleteMany({});
        // 3. Clear Users (Except Admins)
        console.log("🧹 Clearing non-admin users...");
        const { count } = yield prisma.user.deleteMany({
            where: {
                id: { notIn: adminIds }
            }
        });
        console.log(`✅ Purge Complete. Deleted ${count} users. Transactions and logs cleared.`);
        console.log("📦 Products, Categories, Units, and Locations remain intact.");
    });
}
main()
    .catch((e) => {
    console.error("❌ Purge Failed:", e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
