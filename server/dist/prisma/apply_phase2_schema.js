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
function applyPhase2Schema() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Applying Phase 2 Transaction Schema Changes via Raw SQL...");
        // 1. Rename 'price' to 'sellingPrice'
        try {
            yield prisma_1.default.$executeRawUnsafe(`ALTER TABLE "OrderItem" RENAME COLUMN "price" TO "sellingPrice";`);
            console.log("✅ Renamed price -> sellingPrice");
        }
        catch (e) {
            if (e.message.includes('column "price" does not exist')) {
                console.log("⚠️ price column already renamed.");
            }
            else {
                throw e;
            }
        }
        // 2. Rename 'costAtTimeOfSale' to 'costPriceSnapshot'
        try {
            yield prisma_1.default.$executeRawUnsafe(`ALTER TABLE "OrderItem" RENAME COLUMN "costAtTimeOfSale" TO "costPriceSnapshot";`);
            console.log("✅ Renamed costAtTimeOfSale -> costPriceSnapshot");
        }
        catch (e) {
            if (e.message.includes('column "costAtTimeOfSale" does not exist')) {
                console.log("⚠️ costAtTimeOfSale column already renamed.");
            }
            else {
                throw e;
            }
        }
        // 3. Add 'marginSnapshot'
        try {
            yield prisma_1.default.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "marginSnapshot" DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
            console.log("✅ Added marginSnapshot column");
        }
        catch (e) {
            if (e.message.includes('column "marginSnapshot" of relation "OrderItem" already exists')) {
                console.log("⚠️ marginSnapshot column already exists.");
            }
            else {
                throw e;
            }
        }
        console.log("Success! Phase 2 Schema active.");
    });
}
applyPhase2Schema()
    .catch(console.error)
    .finally(() => prisma_1.default.$disconnect());
