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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🚀 Applying Phase 3 Schema Changes...');
        try {
            // 1. Create Enums if they don't exist
            yield prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
            // 2. Add SPOILAGE to InventoryLogType
            yield prisma.$executeRawUnsafe(`
            ALTER TYPE "InventoryLogType" ADD VALUE IF NOT EXISTS 'SPOILAGE';
        `);
            // 3. Create SecurityAuditLog Table
            yield prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "SecurityAuditLog" (
                "id" TEXT NOT NULL,
                "tableName" TEXT NOT NULL,
                "attemptedOperation" TEXT NOT NULL,
                "attemptedBy" TEXT,
                "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "rawQuerySnippet" TEXT,
                "severity" TEXT NOT NULL DEFAULT 'CRITICAL',
                CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
            );
        `);
            // 4. Update CashierShift Table
            yield prisma.$executeRawUnsafe(`
            ALTER TABLE "CashierShift" 
            ADD COLUMN IF NOT EXISTS "expectedCash" DECIMAL(10,2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "expectedOnline" DECIMAL(10,2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "expectedCredit" DECIMAL(10,2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "declaredCash" DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS "variance" DECIMAL(10,2);
        `);
            // 5. Create Unique Partial Index for CashierShift (One Open Shift per User)
            // We drop existing unique if any and recreate
            yield prisma.$executeRawUnsafe(`
            DROP INDEX IF EXISTS "CashierShift_one_open_per_user";
            CREATE UNIQUE INDEX "CashierShift_one_open_per_user" 
            ON "CashierShift"("userId") 
            WHERE "status" = 'OPEN';
        `);
            // 6. Create Refund and RefundItem Tables
            yield prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Refund" (
                "id" TEXT NOT NULL,
                "orderId" TEXT NOT NULL,
                "cashierShiftId" TEXT NOT NULL,
                "totalAmount" DECIMAL(10,2) NOT NULL,
                "reason" TEXT,
                "status" "RefundStatus" NOT NULL DEFAULT 'COMPLETED',
                "idempotencyKey" TEXT,
                "eventId" UUID NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,
                CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
                CONSTRAINT "Refund_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
            CREATE INDEX IF NOT EXISTS "Refund_orderId_idx" ON "Refund"("orderId");
            CREATE INDEX IF NOT EXISTS "Refund_cashierShiftId_idx" ON "Refund"("cashierShiftId");
            CREATE INDEX IF NOT EXISTS "Refund_eventId_idx" ON "Refund"("eventId");
        `);
            yield prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "RefundItem" (
                "id" TEXT NOT NULL,
                "refundId" TEXT NOT NULL,
                "orderItemId" TEXT NOT NULL,
                "quantityRefunded" INTEGER NOT NULL,
                "amountRefunded" DECIMAL(10,2) NOT NULL,
                "originalSellingPriceSnapshot" DECIMAL(10,2) NOT NULL,
                "originalCostSnapshot" DECIMAL(10,2) NOT NULL,
                "isRestocked" BOOLEAN NOT NULL DEFAULT true,
                CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
                CONSTRAINT "RefundItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "RefundItem_refundId_idx" ON "RefundItem"("refundId");
        `);
            // 7. Create CashDrawerAdjustment Table
            yield prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "CashDrawerAdjustment" (
                "id" TEXT NOT NULL,
                "shiftId" TEXT NOT NULL,
                "amount" DECIMAL(10,2) NOT NULL,
                "type" TEXT NOT NULL,
                "reason" TEXT NOT NULL,
                "supervisorId" TEXT NOT NULL,
                "eventId" UUID NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "CashDrawerAdjustment_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "CashDrawerAdjustment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashierShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
                CONSTRAINT "CashDrawerAdjustment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "CashDrawerAdjustment_shiftId_idx" ON "CashDrawerAdjustment"("shiftId");
            CREATE INDEX IF NOT EXISTS "CashDrawerAdjustment_eventId_idx" ON "CashDrawerAdjustment"("eventId");
        `);
            console.log('✅ Phase 3 Schema Changes Applied Successfully!');
        }
        catch (error) {
            console.error('❌ Error applying Phase 3 Schema changes:', error);
            process.exit(1);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
main();
