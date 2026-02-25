import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

import { PrismaClient } from "@prisma/client";
import prisma from "../src/config/prisma";

async function applyPhase2Schema() {
    console.log("Applying Phase 2 Transaction Schema Changes via Raw SQL...");

    // 1. Rename 'price' to 'sellingPrice'
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" RENAME COLUMN "price" TO "sellingPrice";`);
        console.log("✅ Renamed price -> sellingPrice");
    } catch (e: any) {
        if (e.message.includes('column "price" does not exist')) {
            console.log("⚠️ price column already renamed.");
        } else {
            throw e;
        }
    }

    // 2. Rename 'costAtTimeOfSale' to 'costPriceSnapshot'
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" RENAME COLUMN "costAtTimeOfSale" TO "costPriceSnapshot";`);
        console.log("✅ Renamed costAtTimeOfSale -> costPriceSnapshot");
    } catch (e: any) {
        if (e.message.includes('column "costAtTimeOfSale" does not exist')) {
            console.log("⚠️ costAtTimeOfSale column already renamed.");
        } else {
            throw e;
        }
    }

    // 3. Add 'marginSnapshot'
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "marginSnapshot" DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
        console.log("✅ Added marginSnapshot column");
    } catch (e: any) {
        if (e.message.includes('column "marginSnapshot" of relation "OrderItem" already exists')) {
            console.log("⚠️ marginSnapshot column already exists.");
        } else {
            throw e;
        }
    }

    console.log("Success! Phase 2 Schema active.");
}

applyPhase2Schema()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
