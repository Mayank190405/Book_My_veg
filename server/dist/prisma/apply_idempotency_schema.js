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
function applyIdempotencySchema() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Applying Idempotency Schema Changes via Raw SQL...");
        try {
            yield prisma_1.default.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT UNIQUE;`);
            console.log("✅ Added idempotencyKey column to Order");
        }
        catch (e) {
            if (e.message.includes('column "idempotencyKey" of relation "Order" already exists')) {
                console.log("⚠️ idempotencyKey column already exists.");
            }
            else {
                throw e;
            }
        }
        console.log("Success! Idempotency Schema active.");
    });
}
applyIdempotencySchema()
    .catch(console.error)
    .finally(() => prisma_1.default.$disconnect());
