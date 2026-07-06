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
function applyKhataImmutability() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Applying KhataTransaction Immutability Triggers via Raw SQL...");
        const checkTriggerExists = yield prisma_1.default.$queryRaw `
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'KhataTransaction' AND trigger_name = 'prevent_khata_transaction_update_delete';
    `;
        if (checkTriggerExists && checkTriggerExists.length > 0) {
            console.log("⚠️ KhataTransaction immutability trigger already exists.");
            return;
        }
        try {
            yield prisma_1.default.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION prevent_khata_transaction_mutation()
            RETURNS TRIGGER AS $$
    BEGIN
                RAISE EXCEPTION 'KhataTransaction records are immutable. UPDATE and DELETE are strictly forbidden.';
    END;
            $$ LANGUAGE plpgsql;
    `);
            yield prisma_1.default.$executeRawUnsafe(`
            CREATE TRIGGER prevent_khata_transaction_update_delete
            BEFORE UPDATE OR DELETE ON "KhataTransaction"
            FOR EACH ROW
            EXECUTE FUNCTION prevent_khata_transaction_mutation();
    `);
            console.log("✅ Successfully applied KhataTransaction immutability constraint!");
        }
        catch (e) {
            console.error("❌ Failed to apply Khata immutability constraint:", e);
        }
    });
}
applyKhataImmutability()
    .catch(console.error)
    .finally(() => prisma_1.default.$disconnect());
