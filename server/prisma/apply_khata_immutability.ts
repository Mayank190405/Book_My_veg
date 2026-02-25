import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

import { PrismaClient } from "@prisma/client";
import prisma from "../src/config/prisma";

async function applyKhataImmutability() {
    console.log("Applying KhataTransaction Immutability Triggers via Raw SQL...");

    const checkTriggerExists = await prisma.$queryRaw<any[]>`
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'KhataTransaction' AND trigger_name = 'prevent_khata_transaction_update_delete';
    `;

    if (checkTriggerExists && checkTriggerExists.length > 0) {
        console.log("⚠️ KhataTransaction immutability trigger already exists.");
        return;
    }

    try {
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION prevent_khata_transaction_mutation()
            RETURNS TRIGGER AS $$
    BEGIN
                RAISE EXCEPTION 'KhataTransaction records are immutable. UPDATE and DELETE are strictly forbidden.';
    END;
            $$ LANGUAGE plpgsql;
    `);

        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER prevent_khata_transaction_update_delete
            BEFORE UPDATE OR DELETE ON "KhataTransaction"
            FOR EACH ROW
            EXECUTE FUNCTION prevent_khata_transaction_mutation();
    `);

        console.log("✅ Successfully applied KhataTransaction immutability constraint!");
    } catch (e) {
        console.error("❌ Failed to apply Khata immutability constraint:", e);
    }
}

applyKhataImmutability()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
