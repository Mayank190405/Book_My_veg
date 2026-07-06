"use strict";
/**
 * patch-images.ts
 * Run with: node -r ts-node/register -r dotenv/config prisma/patch-images.ts
 *
 * Fixes broken product image URLs in the database.
 */
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
const FIXES = {
    // Mint (Pudina) - old URL 404s
    "mint-pudina": "https://images.pexels.com/photos/983520/pexels-photo-983520.jpeg?auto=compress&cs=tinysrgb&w=500",
    // Green Amaranth - Amazon CDN URL 404s
    "green-amaranth": "https://images.pexels.com/photos/2255935/pexels-photo-2255935.jpeg?auto=compress&cs=tinysrgb&w=500",
    // Red Amaranth - also likely broken
    "red-amaranth": "https://images.pexels.com/photos/1453799/pexels-photo-1453799.jpeg?auto=compress&cs=tinysrgb&w=500",
    // Dill Leaves - iStockPhoto URL may break
    "dill-leaves-shepu": "https://images.pexels.com/photos/4113903/pexels-photo-4113903.jpeg?auto=compress&cs=tinysrgb&w=500",
    // Spring Onion - Metro.ca CDN
    "spring-onion": "https://images.pexels.com/photos/128402/pexels-photo-128402.jpeg?auto=compress&cs=tinysrgb&w=500",
    // Curry Leaves - Healthline
    "curry-leaves": "https://images.pexels.com/photos/4750270/pexels-photo-4750270.jpeg?auto=compress&cs=tinysrgb&w=500",
};
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🔧 Patching broken image URLs...");
        for (const [slug, newUrl] of Object.entries(FIXES)) {
            const product = yield prisma.product.findUnique({ where: { slug } });
            if (!product) {
                console.log(`  ⚠️  Product not found for slug: ${slug}`);
                continue;
            }
            yield prisma.product.update({
                where: { slug },
                data: { images: [newUrl] },
            });
            console.log(`  ✅ Updated ${product.name} → ${newUrl}`);
        }
        console.log("🚀 Image patch complete!");
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
