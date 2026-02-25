
import { AccountingService } from './src/services/accountingService';
import { InventoryService, InventoryLogType } from './src/services/inventoryService';
import prisma from "./src/config/prisma";
import { Prisma, OrderStatus } from "@prisma/client";

async function verifyHardenedServices() {
    const RUN_ID = Date.now().toString().slice(-6);
    console.log(`Starting Isolated Service Layer Verification (Run: ${RUN_ID})...`);

    try {
        // 1. Setup Mock Location & Accounts
        const location = await prisma.location.upsert({
            where: { id: "TEST_LOC_1" },
            update: {},
            create: { id: "TEST_LOC_1", name: "Test Warehouse" }
        });

        const coaCash = await prisma.chartOfAccount.upsert({
            where: { code: "1001" },
            update: {},
            create: { code: "1001", name: "Cash", category: "ASSET" }
        });

        const coaSales = await prisma.chartOfAccount.upsert({
            where: { code: "4001" },
            update: {},
            create: { code: "4001", name: "Sales", category: "REVENUE" }
        });

        console.log("Mocks setup complete.");

        // 2. Test Accounting: Balanced Journal
        console.log("Testing Balanced Journal...");
        await AccountingService.createJournalEntry({
            transactionId: "TX_TEST_BALANCED_" + RUN_ID,
            locationId: location.id,
            entries: [
                { accountId: coaCash.id, debit: 100, credit: 0 },
                { accountId: coaSales.id, debit: 0, credit: 100 }
            ]
        });
        console.log("✔ Balanced Journal accepted.");

        // 3. Test FIFO Inventory Deduction (USE UNIQUE PRODUCT)
        console.log("Testing FIFO Inventory with isolated product...");

        const category = await prisma.category.upsert({
            where: { slug: "test-cat" },
            update: {},
            create: { name: "Test Category", slug: "test-cat" }
        });

        const product = await prisma.product.create({
            data: {
                name: "FIFO Test Product " + RUN_ID,
                slug: "fifo-test-" + RUN_ID,
                basePrice: 100,
                isActive: true,
                category: { connect: { id: category.id } }
            }
        });

        const batchOldName = "OLD_" + RUN_ID;
        const batchNewName = "NEW_" + RUN_ID;

        // Add 2 batches with explicit delay to ensure FIFO ordering
        await InventoryService.addStock({
            productId: product.id,
            locationId: location.id,
            quantity: 10,
            costPrice: 50,
            batchNumber: batchOldName
        });

        await new Promise(r => setTimeout(r, 1000)); // 1 second delay

        await InventoryService.addStock({
            productId: product.id,
            locationId: location.id,
            quantity: 10,
            costPrice: 60,
            batchNumber: batchNewName
        });

        // Deduct 15 (should take 10 from OLD and 5 from NEW)
        await InventoryService.deductStock({
            items: [{ productId: product.id, quantity: 15 }],
            locationId: location.id,
            type: InventoryLogType.SALE
        });

        const oldBatch = await prisma.batch.findFirst({ where: { batchNumber: batchOldName } });
        const newBatch = await prisma.batch.findFirst({ where: { batchNumber: batchNewName } });

        console.log(`[VERIFY] ${batchOldName}: ${oldBatch?.remainingQty}, ${batchNewName}: ${newBatch?.remainingQty}`);

        const oldRemaining = new Prisma.Decimal(oldBatch?.remainingQty || -1);
        const newRemaining = new Prisma.Decimal(newBatch?.remainingQty || -1);

        if (oldRemaining.equals(0) && newRemaining.equals(5)) {
            console.log("✔ FIFO Deduction correctly prioritized old batch.");
        } else {
            console.error("✘ FIFO Deduction failed! Expected 0 and 5.");
        }

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit();
    }
}

verifyHardenedServices();
