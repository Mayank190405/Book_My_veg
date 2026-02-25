-- CreateEnum
CREATE TYPE "InventoryLedgerReferenceType" AS ENUM ('ORDER', 'REFUND', 'MORTALITY', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "InventoryLedger" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "referenceType" "InventoryLedgerReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryLedger_storeId_idx" ON "InventoryLedger"("storeId");

-- CreateIndex
CREATE INDEX "InventoryLedger_productId_idx" ON "InventoryLedger"("productId");

-- Hardened Inventory Phase 1 Constraints
ALTER TABLE "Inventory" ADD CONSTRAINT "check_non_negative_stock" CHECK ("currentStock" >= 0);
