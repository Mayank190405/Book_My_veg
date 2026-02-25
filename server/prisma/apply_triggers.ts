import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

import { PrismaClient } from '@prisma/client';
import prisma from '../src/config/prisma';

async function applyImmutabilityTriggers() {
    console.log("Applying InventoryLedger immutability triggers...");

    await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_inventory_ledger_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'InventoryLedger is an append-only table. UPDATE and DELETE operations are strictly prohibited for auditing purposes.';
        END;
        $$ LANGUAGE plpgsql;
    `);

    await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trg_prevent_ledger_update ON "InventoryLedger";
    `);

    await prisma.$executeRawUnsafe(`
        CREATE TRIGGER trg_prevent_ledger_update
        BEFORE UPDATE ON "InventoryLedger"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_inventory_ledger_mutation();
    `);

    await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trg_prevent_ledger_delete ON "InventoryLedger";
    `);

    await prisma.$executeRawUnsafe(`
        CREATE TRIGGER trg_prevent_ledger_delete
        BEFORE DELETE ON "InventoryLedger"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_inventory_ledger_mutation();
    `);

    console.log("Success! Immutability triggers active.");
}

applyImmutabilityTriggers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
