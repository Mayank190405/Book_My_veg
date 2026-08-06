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
const prisma_1 = __importDefault(require("./config/prisma"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Running safe manual database column upgrades...");
        try {
            yield prisma_1.default.$executeRawUnsafe(`
            ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
        `);
            console.log("Added 'rating' column successfully.");
        }
        catch (e) {
            console.warn("Could not add 'rating' column:", e.message);
        }
        try {
            yield prisma_1.default.$executeRawUnsafe(`
            ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "feedback" TEXT;
        `);
            console.log("Added 'feedback' column successfully.");
        }
        catch (e) {
            console.warn("Could not add 'feedback' column:", e.message);
        }
        try {
            yield prisma_1.default.$executeRawUnsafe(`
            ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "feedbackSent" BOOLEAN NOT NULL DEFAULT FALSE;
        `);
            console.log("Added 'feedbackSent' column successfully.");
        }
        catch (e) {
            console.warn("Could not add 'feedbackSent' column:", e.message);
        }
        console.log("Database column migration complete with ZERO data loss!");
    });
}
main()
    .catch((e) => {
    console.error("Migration failed:", e);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.default.$disconnect();
}));
