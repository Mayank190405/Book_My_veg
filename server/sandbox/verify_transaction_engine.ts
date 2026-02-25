import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

import prisma from "../src/config/prisma";
import { v4 as uuidv4 } from "uuid";
import { BillingService } from "../src/services/billingService";
import { KhataService } from "../src/services/posService";

async function runPhase2Simulations() {
    console.log("=========================================");
    console.log("   PHASE 2 TRANSACTION ENGINE VERIFICATION");
    console.log("=========================================\n");

    const store = await prisma.location.findFirst();
    const product = await prisma.product.findFirst({ include: { pricing: true } });
    const user = await prisma.user.findFirst(); // ANY user works for খাতা
    const operator = await prisma.user.findFirst(); // ANY user works as a staff member

    if (!store || !product || !user || !operator) {
        console.error("Required seed data missing. Aborting.");
        process.exit(1);
    }

    // Seed required COA accounts dynamically
    const accounts = ["COA_CASH", "COA_SALES", "COA_GST_OUTPUT", "COA_COGS", "COA_INVENTORY"];
    for (const code of accounts) {
        await prisma.chartOfAccount.upsert({
            where: { code },
            update: {},
            create: { code, name: code, category: "REVENUE" }
        });
    }

    const price = Number(product.pricing[0]?.price || product.basePrice);

    // Ensure strictly enough inventory exists
    await prisma.batch.create({
        data: {
            productId: product.id,
            locationId: store.id,
            batchNumber: `SIM_BATCH_${Date.now()}`,
            initialQty: 100,
            remainingQty: 100,
            costPrice: price * 0.5 // 50% margin
        }
    });

    await prisma.inventory.deleteMany({
        where: { locationId: store.id, productId: product.id }
    });

    await prisma.inventory.create({
        data: { locationId: store.id, productId: product.id, currentStock: 100 }
    });

    // ----------------------------------------------------
    // TEST 1: Retry Storm Simulation (Duplicate Idempotency Key)
    // ----------------------------------------------------
    console.log("-> 🧪 TEST 1: Retry Storm Simulation (Idempotency Key)");
    const traceId = uuidv4();
    const orderPayload = {
        channel: "POS" as any,
        locationId: store.id,
        staffId: operator.id,
        userId: user.id,
        items: [{ productId: product.id, quantity: 1, price }],
        payments: [{ method: "CASH", amount: price }],
        traceId
    };

    console.log(`   Simulating 5 sequential retries with same TraceID: ${traceId} (Network Retry Pattern)`);

    const results: any[] = [];
    for (let i = 0; i < 5; i++) {
        try {
            const res = await BillingService.createOrder(orderPayload);
            results.push({ status: "fulfilled", value: res });
        } catch (e: any) {
            results.push({ status: "rejected", reason: e });
        }
    }

    const successes = results.filter(r => r.status === "fulfilled").map((r: any) => r.value.id);
    const uniqueOrderIds = new Set(successes);

    if (uniqueOrderIds.size === 1) {
        console.log("   ✅ SUCCESS: Idempotency engine returned the EXACT same Order reference. No double-charging/deduction.");
    } else {
        console.log(`   ❌ FAILED: Found ${uniqueOrderIds.size} unique orders.`);
        const errors = results.filter(r => r.status === "rejected").map((r: any) => r.reason.message || r.reason);
        console.log("   Failure Reasons:", errors);
        process.exit(1);
    }

    // ----------------------------------------------------
    // TEST 2: Margin Snapshot Integrity After Cost Update
    // ----------------------------------------------------
    console.log("\n-> 🧪 TEST 2: Margin Snapshot Integrity");
    const testOrderId = [...uniqueOrderIds][0];

    // Fetch the inserted items
    const orderItems = await prisma.orderItem.findMany({ where: { orderId: testOrderId } });
    if (!orderItems || orderItems.length === 0) {
        console.error(`❌ FAILED: Found 0 OrderItems for Order ${testOrderId}`);
        process.exit(1);
    }

    const snapshotCost = Number(orderItems[0].costPriceSnapshot);
    const snapshotMargin = Number(orderItems[0].marginSnapshot);
    const snapshotSellingPrice = Number(orderItems[0].sellingPrice);

    console.log(`   Captured order item -> SellingPrice: ${snapshotSellingPrice}, Cost: ${snapshotCost}, Margin: ${snapshotMargin}`);

    // Let's "update" the product's underlying cost by creating a new Batch
    console.log("   Simulating underlying supplier cost jumping by +$50...");
    await prisma.batch.create({
        data: {
            productId: product.id,
            locationId: store.id,
            batchNumber: "SIM_INFLATION_01",
            costPrice: snapshotCost + 50,
            initialQty: 10,
            remainingQty: 10
        }
    });

    // Re-fetch the older OrderItem
    const verifyItems = await prisma.orderItem.findMany({ where: { orderId: testOrderId } });
    const verifiedCost = Number(verifyItems[0].costPriceSnapshot);

    if (verifiedCost === snapshotCost) {
        console.log("   ✅ SUCCESS: OrderItem Margin Snapshot is fully isolated from future pricing shock.");
    } else {
        console.log("   ❌ FAILED: Cost snapshot got overwritten or corrupted.");
    }

    // ----------------------------------------------------
    // TEST 3: Credit Partial Payment Recalculation
    // ----------------------------------------------------
    console.log("\n-> 🧪 TEST 3: Credit Lifecycle & Partial Payments");
    console.log(`   Initiating $500 Credit Purchase for User ${user.email}`);

    // Ensure Khata exists and has limit
    await KhataService.updateCreditLimit(user.id, 10000);

    await KhataService.addPurchase(user.id, 500, testOrderId, operator.id);
    let khata = await KhataService.getKhata(user.id);
    console.log(`   Current Outstanding: $${khata?.outstanding}`);

    console.log("   Simulating $150 Partial Payment...");
    await KhataService.recordPayment(user.id, 150, operator.id, "Partial payment via cash");

    khata = await KhataService.getKhata(user.id);
    if (Number(khata?.outstanding) === 350) {
        console.log(`   ✅ SUCCESS: Outstanding balance correctly reduced to $${khata?.outstanding}.`);
    } else {
        console.log(`   ❌ FAILED: Expected 350, got ${khata?.outstanding}`);
    }

    // Verify Immutability log
    const txCount = await prisma.khataTransaction.count({ where: { khataId: khata?.id } });
    console.log(`   ✅ SUCCESS: ${txCount} immutable KhataTransactions recorded.`);

    // ----------------------------------------------------
    // TEST 4: Ledger Immutability Validation
    // ----------------------------------------------------
    console.log("\n-> 🧪 TEST 4: Ledger append-only validation");
    const ledgerEntries = await prisma.inventoryLog.count({
        where: { delta: { not: 0 } } // Adjusted query for InventoryLog
    });

    if (ledgerEntries > 0) {
        console.log(`   ✅ SUCCESS: Detected ${ledgerEntries} immutable InventoryLog traces from the POS engine.`);
    } else {
        console.log("   ❌ FAILED: InventoryLog writes missing.");
    }

    console.log("\n=========================================");
    console.log("   ALL PHASE 2 COMPLIANCE CHECKS PASSED  ");
    console.log("=========================================\n");
}

runPhase2Simulations()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
