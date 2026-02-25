/**
 * patch-images.ts
 * Run with: node -r ts-node/register -r dotenv/config prisma/patch-images.ts
 * 
 * Fixes broken product image URLs in the database.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const FIXES: Record<string, string> = {
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

async function main() {
    console.log("🔧 Patching broken image URLs...");

    for (const [slug, newUrl] of Object.entries(FIXES)) {
        const product = await prisma.product.findUnique({ where: { slug } });
        if (!product) {
            console.log(`  ⚠️  Product not found for slug: ${slug}`);
            continue;
        }

        await prisma.product.update({
            where: { slug },
            data: { images: [newUrl] },
        });

        console.log(`  ✅ Updated ${product.name} → ${newUrl}`);
    }

    console.log("🚀 Image patch complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
