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
        console.log('🚀 Applying Purchase Order Schema & Roles...');
        try {
            // 1. Add PURCHASE_MANAGER to Role enum
            yield prisma.$executeRawUnsafe(`
            ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PURCHASE_MANAGER';
        `).catch(err => console.log('Role enum update:', err.message));
            // 2. Create POStatus Enum
            yield prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `).catch(err => console.log('POStatus enum creation:', err.message));
            // 3. Create PurchaseOrder Table
            yield prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
                "id" TEXT NOT NULL,
                "poNumber" TEXT NOT NULL,
                "locationId" TEXT NOT NULL,
                "createdById" TEXT NOT NULL,
                "reviewedById" TEXT,
                "supplierName" TEXT,
                "supplierPhone" TEXT,
                "notes" TEXT,
                "status" "POStatus" NOT NULL DEFAULT 'SUBMITTED',
                "totalEstimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "actualCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "expectedDate" TIMESTAMP(3),
                "receivedAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
        `).catch(err => console.log('PurchaseOrder table:', err.message));
            // 4. Create PurchaseOrderItem Table & Columns
            yield prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
                "id" TEXT NOT NULL,
                "purchaseOrderId" TEXT NOT NULL,
                "productId" TEXT NOT NULL,
                "variantId" TEXT,
                "requestedQty" DECIMAL(12,3) NOT NULL,
                "approvedQty" DECIMAL(12,3),
                "receivedQty" DECIMAL(12,3),
                "buyingPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
                "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "addedByManager" BOOLEAN NOT NULL DEFAULT false,
                "itemStatus" TEXT NOT NULL DEFAULT 'APPROVED',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
            );
            ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "purchaseManagerId" TEXT;
            ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "itemStatus" TEXT DEFAULT 'APPROVED';
        `).catch(err => console.log('PurchaseOrderItem table:', err.message));
            // 5. Create PurchaseManagerLocation Table
            yield prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "PurchaseManagerLocation" (
                "id" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                "locationId" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PurchaseManagerLocation_pkey" PRIMARY KEY ("id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseManagerLocation_userId_locationId_key" ON "PurchaseManagerLocation"("userId", "locationId");
        `).catch(err => console.log('PurchaseManagerLocation table:', err.message));
            console.log('✅ Purchase Order Schema & Tables ensured!');
        }
        catch (err) {
            console.error('⚠️ Purchase Order schema migration warning:', err.message);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
main();
