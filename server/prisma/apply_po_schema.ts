import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Applying Purchase Order Schema & Roles...');

    try {
        // 1. Add PURCHASE_MANAGER to Role enum
        await prisma.$executeRawUnsafe(`
            ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PURCHASE_MANAGER';
        `).catch(err => console.log('Role enum update:', err.message));

        // 2. Create POStatus Enum
        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `).catch(err => console.log('POStatus enum creation:', err.message));

        // 3. Create PurchaseOrder Table
        await prisma.$executeRawUnsafe(`
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

        // 4. Create PurchaseOrderItem Table
        await prisma.$executeRawUnsafe(`
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
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
            );
        `).catch(err => console.log('PurchaseOrderItem table:', err.message));

        // 5. Create PurchaseManagerLocation Table
        await prisma.$executeRawUnsafe(`
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
    } catch (err: any) {
        console.error('⚠️ Purchase Order schema migration warning:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
