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
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🚀 Initializing Production Seed (Zero Data Mode)...");
        // 1. Create Essential Measurement Units
        const initialUnits = [
            { name: 'Kilogram', symbol: 'KG' },
            { name: 'Gram', symbol: 'GM' },
            { name: 'Liter', symbol: 'LTR' },
            { name: 'Milliliter', symbol: 'ML' },
            { name: 'Piece', symbol: 'PIECE' },
            { name: 'Packet', symbol: 'PACKET' },
        ];
        for (const unit of initialUnits) {
            yield prisma.unit.upsert({
                where: { name: unit.name },
                update: {},
                create: {
                    name: unit.name,
                    symbol: unit.symbol,
                    isActive: true,
                },
            });
        }
        console.log("✅ Measurement units operational");
        // 2. Create Initial Main Hub (Required for system context)
        const mainHub = yield prisma.location.upsert({
            where: { slug: "main-hub" },
            update: {},
            create: {
                name: "Main Hub",
                slug: "main-hub",
                address: "Primary Distribution Center",
                latitude: 28.6139,
                longitude: 77.2090
            },
        });
        console.log("✅ Main Hub established");
        // 3. Create Root Super Admin
        const hashedPassword = yield bcryptjs_1.default.hash("admin123", 10);
        yield prisma.user.upsert({
            where: { phone: "9999999999" },
            update: {
                password: hashedPassword,
                role: client_1.Role.ADMIN,
            },
            create: {
                phone: "9999999999",
                email: "admin@bookmyveg.com",
                name: "Super Admin",
                role: client_1.Role.ADMIN,
                password: hashedPassword,
                isActive: true,
            }
        });
        console.log("✅ Super Admin account created");
        console.log("-----------------------------------------");
        console.log("USER: 9999999999");
        console.log("PASS: admin123");
        console.log("-----------------------------------------");
        console.log("🌱 Database is now ready for deployment.");
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
