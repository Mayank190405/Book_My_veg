import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
import { PrismaClient } from "@prisma/client";
import prisma from "../src/config/prisma";

async function verifyLedger() {
    console.log("=== Phase 1 Validation: Ledger Immutability ===");

    // 1. Get any recent ledger entry
    const entry = await prisma.inventoryLog.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!entry) {
        console.log("No ledger entries found to test. Please run concurrency test first to generate entries.");
        return;
    }

    console.log(`\nTesting Immutability on Ledger ID: ${entry.id}`);

    // 2. Attempt UPDATE
    try {
        console.log("-> 🛑 Attempting malicious UPDATE...");
        await prisma.inventoryLog.update({
            where: { id: entry.id },
            data: { delta: 9999 }
        });
        console.log("❌ FAILED: Update was allowed! Trigger is broken.");
    } catch (err: any) {
        console.log("✅ SUCCESS: Update explicitly blocked by DB Trigger.");
        console.log(`   Rejection Reason: ${err.message.split('\\n')[0].substring(0, 100)}...`);
    }

    // 3. Attempt DELETE
    try {
        console.log("-> 🛑 Attempting malicious DELETE...");
        await prisma.inventoryLog.delete({
            where: { id: entry.id }
        });
        console.log("❌ FAILED: Delete was allowed! Trigger is broken.");
    } catch (err: any) {
        console.log("✅ SUCCESS: Delete explicitly blocked by DB Trigger.");
        console.log(`   Rejection Reason: ${err.message.split('\\n')[0].substring(0, 100)}...`);
    }
}

verifyLedger()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
