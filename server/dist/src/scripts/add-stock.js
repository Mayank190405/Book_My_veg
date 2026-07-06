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
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
function addStock() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Get all locations
        const locations = yield prisma_1.default.location.findMany();
        console.log('All locations:', locations.map(l => ({ id: l.id, slug: l.slug })));
        const products = yield prisma_1.default.product.findMany({ take: 50 });
        console.log(`Found ${products.length} products`);
        // Make sure all products are active
        if (products.length > 0) {
            yield prisma_1.default.product.updateMany({ data: { isActive: true } });
            console.log(`Activated all ${products.length} products`);
        }
        for (const location of locations) {
            for (const product of products) {
                // Check total remaining stock
                const batches = yield prisma_1.default.batch.findMany({
                    where: { productId: product.id, locationId: location.id, remainingQty: { gt: 0 } }
                });
                const totalRemaining = batches.reduce((acc, b) => acc + Number(b.remainingQty), 0);
                if (totalRemaining < 20) {
                    // Top up stock
                    yield prisma_1.default.batch.create({
                        data: {
                            productId: product.id,
                            locationId: location.id,
                            batchNumber: `TOPUP-${Date.now()}-${product.id.substring(0, 4)}`,
                            costPrice: (_a = product.basePrice) !== null && _a !== void 0 ? _a : new client_1.Prisma.Decimal(0),
                            initialQty: 100,
                            remainingQty: 100,
                            receivedDate: new Date(),
                        }
                    });
                    // Sync inventory table
                    const existingInv = yield prisma_1.default.inventory.findFirst({
                        where: {
                            productId: product.id,
                            locationId: location.id,
                            variantId: null
                        }
                    });
                    if (existingInv) {
                        yield prisma_1.default.inventory.update({
                            where: { id: existingInv.id },
                            data: { currentStock: { increment: 100 } }
                        });
                    }
                    else {
                        yield prisma_1.default.inventory.create({
                            data: {
                                productId: product.id,
                                locationId: location.id,
                                variantId: null,
                                currentStock: 100,
                                thresholdStock: 5,
                            }
                        });
                    }
                    console.log(`✅ Topped up ${product.name} @ ${location.slug} (was ${totalRemaining})`);
                }
                else {
                    console.log(`⏩ Sufficient stock: ${product.name} @ ${location.slug} — ${totalRemaining} units`);
                }
            }
        }
        console.log('Done!');
    });
}
addStock().catch(console.error).finally(() => prisma_1.default.$disconnect());
