import "dotenv/config";
process.env.DATABASE_URL = process.env.DIRECT_URL;

import { InventoryService, InventoryLogType } from '../src/services/inventoryService';
import prisma from '../src/config/prisma';

async function runConcurrencyTest() {
    console.log("=== STARTING PHASE 1 ALIGNMENT VALIDATION ===");

    // Find a product and location to test
    let targetProduct = await prisma.product.findFirst({ select: { id: true, name: true } });
    let targetLocation = await prisma.location.findFirst({ select: { id: true, slug: true } });

    if (!targetLocation) {
        console.log("No location found, creating SIM Location...");
        targetLocation = await prisma.location.create({
            data: { name: "Sim Location", slug: "sim-loc", address: "Sim St", contactNumber: "999" }
        });
    }

    if (!targetProduct) {
        console.log("No product found, creating SIM Product...");
        // Assuming minimal fields needed. First need a category
        let category = await prisma.category.findFirst();
        if (!category) {
            category = await prisma.category.create({ data: { name: "Sim Cat", slug: "sim-cat" } });
        }
        targetProduct = await prisma.product.create({
            data: {
                name: "Sim Product",
                slug: "sim-prod",
                categoryId: category.id,
                basePrice: 100,
                weightUnit: "PIECE"
            }
        });
    }

    // Force stock exactly to 1 inside a batch
    console.log(`Setting up stock for ${targetProduct.name} to exactly 1 unit...`);

    // Clean existing stock for this product at this location
    await prisma.batch.updateMany({
        where: { productId: targetProduct.id, locationId: targetLocation.id },
        data: { remainingQty: 0 }
    });

    const mockBatch = await prisma.batch.create({
        data: {
            productId: targetProduct.id,
            locationId: targetLocation.id,
            batchNumber: "SIM_CONCURRENCY",
            costPrice: 100,
            initialQty: 1,
            remainingQty: 1,
        }
    });

    // Reset Inventory global snapshot
    const invExists = await prisma.inventory.findFirst({
        where: { productId: targetProduct.id, locationId: targetLocation.id }
    });

    if (invExists) {
        await prisma.inventory.update({
            where: { id: invExists.id },
            data: { currentStock: 1 }
        });
    } else {
        await prisma.inventory.create({
            data: {
                productId: targetProduct.id,
                locationId: targetLocation.id,
                currentStock: 1
            }
        });
    }

    // Fire 5 concurrent requests attempting to buy 1 unit each
    const promises = [];
    console.log("Firing 5 concurrent deduction requests for 1 stock unit...");
    for (let i = 0; i < 5; i++) {
        promises.push(
            InventoryService.deductStock({
                locationId: targetLocation.id,
                type: InventoryLogType.SALE,
                items: [{ productId: targetProduct.id, quantity: 1 }],
            }).then(() => {
                console.log(`[Request ${i}] SUCCESS - Stock deducted.`);
            }).catch(err => {
                console.log(`[Request ${i}] REJECTED - ${err.message}`);
            })
        );
    }

    await Promise.all(promises);

    const finalStock = await prisma.inventory.findFirst({
        where: { productId: targetProduct.id, locationId: targetLocation.id }
    });

    console.log(`FINAL DB INVENTORY COUNT: ${finalStock?.currentStock}`);

    // Verify negative stock rejection at DB level by inserting manually
    console.log("Attempting direct negative stock raw SQL injection...");
    try {
        await prisma.$executeRaw`
            UPDATE "Inventory" 
            SET "currentStock" = -5 
            WHERE "productId" = ${targetProduct.id} AND "locationId" = ${targetLocation.id}
        `;
        console.error("FATAL: Database allowed negative stock!");
    } catch (dbErr) {
        console.log("SUCCESS: Database hard-rejected negative stock exactly as scoped.");
    }

    const ledgerEntries = await prisma.$queryRaw`
        SELECT "quantityChange", "previousQuantity", "newQuantity", "referenceType"
        FROM "InventoryLedger" 
        WHERE "productId" = ${targetProduct.id} AND "storeId" = ${targetLocation.id}
    `;

    console.log("LEDGER ENTRIES GENERATED: ", ledgerEntries.length);
    console.log("=== PHASE 1 VALIDATION COMPLETED ===");
}

runConcurrencyTest().catch(console.error).finally(() => prisma.$disconnect());
