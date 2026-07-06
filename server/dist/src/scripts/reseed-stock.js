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
        // Get all products and locations
        const products = yield prisma.product.findMany({ select: { id: true, name: true } });
        const locations = yield prisma.location.findMany({ select: { id: true, name: true } });
        console.log(`Found ${products.length} products & ${locations.length} locations`);
        // Activate all products
        yield prisma.product.updateMany({ data: { isActive: true } });
        console.log("✅ All products activated");
        let batchCount = 0;
        for (const product of products) {
            for (const location of locations) {
                // Check if already have enough
                const existingBatches = yield prisma.batch.findMany({
                    where: { productId: product.id, locationId: location.id, remainingQty: { gt: 0 } }
                });
                const totalRemaining = existingBatches.reduce((acc, b) => acc + Number(b.remainingQty), 0);
                if (totalRemaining < 20) {
                    // Add a new batch
                    yield prisma.batch.create({
                        data: {
                            productId: product.id,
                            locationId: location.id,
                            batchNumber: `RESEED-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                            costPrice: 50,
                            initialQty: 100,
                            remainingQty: 100,
                            receivedDate: new Date(),
                        }
                    });
                    // Update inventory
                    yield prisma.inventory.upsert({
                        where: {
                            productId_locationId_variantId: {
                                productId: product.id,
                                locationId: location.id,
                                variantId: undefined
                            }
                        },
                        update: { currentStock: { increment: 100 } },
                        create: {
                            productId: product.id,
                            locationId: location.id,
                            currentStock: 100,
                            thresholdStock: 5,
                        }
                    });
                    batchCount++;
                    console.log(`  ✅ Added batch for ${product.name} at ${location.name}`);
                }
                else {
                    console.log(`  ⏭️  ${product.name} at ${location.name} already has ${totalRemaining} units`);
                }
            }
        }
        console.log(`\n🎉 Done! Added ${batchCount} new stock batches`);
    });
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
