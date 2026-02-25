import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

import { PrismaClient } from "@prisma/client";
import prisma from "../src/config/prisma";

async function applyIdempotencySchema() {
    console.log("Applying Idempotency Schema Changes via Raw SQL...");

    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT UNIQUE;`);
        console.log("✅ Added idempotencyKey column to Order");
    } catch (e: any) {
        if (e.message.includes('column "idempotencyKey" of relation "Order" already exists')) {
            console.log("⚠️ idempotencyKey column already exists.");
        } else {
            throw e;
        }
    }

    console.log("Success! Idempotency Schema active.");
}

applyIdempotencySchema()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
