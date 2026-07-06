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
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma_1 = __importDefault(require("../src/config/prisma"));
function applyImmutabilityTriggers() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Applying InventoryLedger immutability triggers...");
        yield prisma_1.default.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_inventory_ledger_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'InventoryLedger is an append-only table. UPDATE and DELETE operations are strictly prohibited for auditing purposes.';
        END;
        $$ LANGUAGE plpgsql;
    `);
        yield prisma_1.default.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trg_prevent_ledger_update ON "InventoryLedger";
    `);
        yield prisma_1.default.$executeRawUnsafe(`
        CREATE TRIGGER trg_prevent_ledger_update
        BEFORE UPDATE ON "InventoryLedger"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_inventory_ledger_mutation();
    `);
        yield prisma_1.default.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trg_prevent_ledger_delete ON "InventoryLedger";
    `);
        yield prisma_1.default.$executeRawUnsafe(`
        CREATE TRIGGER trg_prevent_ledger_delete
        BEFORE DELETE ON "InventoryLedger"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_inventory_ledger_mutation();
    `);
        console.log("Success! Immutability triggers active.");
    });
}
applyImmutabilityTriggers()
    .catch(console.error)
    .finally(() => prisma_1.default.$disconnect());
