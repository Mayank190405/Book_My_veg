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
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const initialUnits = [
            { name: 'Kilogram', symbol: 'KG' },
            { name: 'Gram', symbol: 'GM' },
            { name: 'Liter', symbol: 'LTR' },
            { name: 'Milliliter', symbol: 'ML' },
            { name: 'Piece', symbol: 'PIECE' },
            { name: 'Packet', symbol: 'PACKET' },
        ];
        console.log("🌱 Populating Global Unit Registry...");
        for (const unit of initialUnits) {
            yield prisma.unit.upsert({
                where: { name: unit.name },
                update: { symbol: unit.symbol },
                create: {
                    name: unit.name,
                    symbol: unit.symbol,
                    isActive: true,
                },
            });
        }
        console.log("✅ Unit synchronization complete.");
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
