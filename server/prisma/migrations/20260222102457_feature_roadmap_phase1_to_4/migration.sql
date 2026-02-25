-- CreateEnum
CREATE TYPE "MortalityReason" AS ENUM ('ROTTEN', 'DAMAGED', 'EXPIRED', 'SHRINKAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KhataTransactionType" AS ENUM ('PURCHASE', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CRATE', 'THERMAL_BAG', 'VEHICLE', 'OTHER');

-- CreateTable
CREATE TABLE "MandiRate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "Channel" NOT NULL DEFAULT 'POS',
    "costPrice" DECIMAL(10,2) NOT NULL,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MandiRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortalityLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "locationId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reason" "MortalityReason" NOT NULL,
    "notes" TEXT,
    "staffId" TEXT,
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MortalityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerKhata" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditLimit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerKhata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KhataTransaction" (
    "id" TEXT NOT NULL,
    "khataId" TEXT NOT NULL,
    "type" "KhataTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "orderId" TEXT,
    "notes" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KhataTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightVerificationLog" (
    "id" TEXT NOT NULL,
    "sessionRef" TEXT NOT NULL,
    "expectedWeight" DECIMAL(10,3) NOT NULL,
    "actualWeight" DECIMAL(10,3) NOT NULL,
    "variance" DECIMAL(10,3) NOT NULL,
    "isPassed" BOOLEAN NOT NULL,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "assignedTo" TEXT,
    "isReturned" BOOLEAN NOT NULL DEFAULT true,
    "lastAssigned" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverCashLedger" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codTotal" DECIMAL(10,2) NOT NULL,
    "deposited" DECIMAL(10,2) NOT NULL,
    "variance" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverCashLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryOTP" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryOTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "clusterZone" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "DriverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPerformanceLog" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ordersPackaged" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "avgPackTimeMin" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPerformanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MandiRate_productId_idx" ON "MandiRate"("productId");

-- CreateIndex
CREATE INDEX "MandiRate_date_idx" ON "MandiRate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MandiRate_productId_channel_key" ON "MandiRate"("productId", "channel");

-- CreateIndex
CREATE INDEX "MortalityLog_productId_idx" ON "MortalityLog"("productId");

-- CreateIndex
CREATE INDEX "MortalityLog_locationId_idx" ON "MortalityLog"("locationId");

-- CreateIndex
CREATE INDEX "MortalityLog_createdAt_idx" ON "MortalityLog"("createdAt");

-- CreateIndex
CREATE INDEX "StockTransfer_productId_idx" ON "StockTransfer"("productId");

-- CreateIndex
CREATE INDEX "StockTransfer_fromLocationId_idx" ON "StockTransfer"("fromLocationId");

-- CreateIndex
CREATE INDEX "StockTransfer_toLocationId_idx" ON "StockTransfer"("toLocationId");

-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerKhata_userId_key" ON "CustomerKhata"("userId");

-- CreateIndex
CREATE INDEX "KhataTransaction_khataId_idx" ON "KhataTransaction"("khataId");

-- CreateIndex
CREATE INDEX "WeightVerificationLog_sessionRef_idx" ON "WeightVerificationLog"("sessionRef");

-- CreateIndex
CREATE INDEX "DriverCashLedger_driverId_idx" ON "DriverCashLedger"("driverId");

-- CreateIndex
CREATE INDEX "DriverCashLedger_date_idx" ON "DriverCashLedger"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOTP_orderId_key" ON "DeliveryOTP"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverAssignment_orderId_key" ON "DriverAssignment"("orderId");

-- CreateIndex
CREATE INDEX "DriverAssignment_driverId_idx" ON "DriverAssignment"("driverId");

-- CreateIndex
CREATE INDEX "DriverAssignment_status_idx" ON "DriverAssignment"("status");

-- CreateIndex
CREATE INDEX "StaffPerformanceLog_staffId_idx" ON "StaffPerformanceLog"("staffId");

-- CreateIndex
CREATE INDEX "StaffPerformanceLog_date_idx" ON "StaffPerformanceLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceLog_staffId_date_key" ON "StaffPerformanceLog"("staffId", "date");

-- AddForeignKey
ALTER TABLE "MandiRate" ADD CONSTRAINT "MandiRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandiRate" ADD CONSTRAINT "MandiRate_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityLog" ADD CONSTRAINT "MortalityLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityLog" ADD CONSTRAINT "MortalityLog_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityLog" ADD CONSTRAINT "MortalityLog_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityLog" ADD CONSTRAINT "MortalityLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityLog" ADD CONSTRAINT "MortalityLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerKhata" ADD CONSTRAINT "CustomerKhata_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhataTransaction" ADD CONSTRAINT "KhataTransaction_khataId_fkey" FOREIGN KEY ("khataId") REFERENCES "CustomerKhata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAsset" ADD CONSTRAINT "DeliveryAsset_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCashLedger" ADD CONSTRAINT "DriverCashLedger_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOTP" ADD CONSTRAINT "DeliveryOTP_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceLog" ADD CONSTRAINT "StaffPerformanceLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
