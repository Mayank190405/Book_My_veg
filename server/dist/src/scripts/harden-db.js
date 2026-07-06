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
const prisma_1 = __importDefault(require("../config/prisma"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('--- Applying Database Level Integrity Constraints ---');
        try {
            // 1. Prevent negative stock at Postgres level
            yield prisma_1.default.$executeRawUnsafe(`
            ALTER TABLE "Inventory" 
            DROP CONSTRAINT IF EXISTS "inventory_currentstock_check";
        `);
            yield prisma_1.default.$executeRawUnsafe(`
            ALTER TABLE "Inventory" 
            ADD CONSTRAINT "inventory_currentstock_check" 
            CHECK ("currentStock" >= 0);
        `);
            console.log('✅ Added CHECK constraint: currentStock >= 0');
            // 2. Prevent negative opening values in khata
            yield prisma_1.default.$executeRawUnsafe(`
             ALTER TABLE "CustomerKhata" 
             DROP CONSTRAINT IF EXISTS "khata_creditlimit_check";
        `);
            yield prisma_1.default.$executeRawUnsafe(`
             ALTER TABLE "CustomerKhata" 
             ADD CONSTRAINT "khata_creditlimit_check" 
             CHECK ("creditLimit" >= 0);
        `);
            console.log('✅ Added CHECK constraint: creditLimit >= 0');
            console.log('--- Constraints Applied Successfully ---');
        }
        catch (error) {
            console.error('❌ Failed to apply constraints:', error);
        }
        finally {
            yield prisma_1.default.$disconnect();
        }
    });
}
main();
