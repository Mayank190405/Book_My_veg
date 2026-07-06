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
function fixPrices() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting SKU/MRP Sync Protocol...");
        // 1. Fetch all products with their variants
        const products = yield prisma.product.findMany({
            include: {
                variants: true,
                pricing: { where: { channel: client_1.Channel.POS } }
            }
        });
        console.log(`Found ${products.length} merchandise nodes. Checking for pricing voids...`);
        for (const p of products) {
            // Handle Variants
            if (p.variants.length > 0) {
                for (const v of p.variants) {
                    const existing = yield prisma.pricing.findFirst({
                        where: { variantId: v.id, channel: client_1.Channel.POS }
                    });
                    if (!existing) {
                        yield prisma.pricing.create({
                            data: {
                                productId: p.id,
                                variantId: v.id,
                                channel: client_1.Channel.POS,
                                price: v.price,
                                isActive: true
                            }
                        });
                        console.log(`[FIXED] Variant [${v.name}] of [${p.name}]: Linked Price ₹${v.price}`);
                    }
                    else if (Number(existing.price) === 0) {
                        yield prisma.pricing.update({
                            where: { id: existing.id },
                            data: { price: v.price }
                        });
                        console.log(`[UPDATED] Variant [${v.name}] of [${p.name}]: Restored Price ₹${v.price}`);
                    }
                }
            }
            else {
                // Handle Base Product
                const existing = yield prisma.pricing.findFirst({
                    where: { productId: p.id, variantId: null, channel: client_1.Channel.POS }
                });
                const priceVal = p.basePrice || 0;
                if (!existing) {
                    yield prisma.pricing.create({
                        data: {
                            productId: p.id,
                            channel: client_1.Channel.POS,
                            price: priceVal,
                            isActive: true
                        }
                    });
                    console.log(`[FIXED] Product [${p.name}]: Linked Base Price ₹${priceVal}`);
                }
                else if (Number(existing.price) === 0) {
                    yield prisma.pricing.update({
                        where: { id: existing.id },
                        data: { price: priceVal }
                    });
                    console.log(`[UPDATED] Product [${p.name}]: Restored Base Price ₹${priceVal}`);
                }
            }
        }
        console.log("Pricing Synchronization Protocol Complete. MRP Visibility Restored. 🚀");
    });
}
fixPrices()
    .catch(e => console.error(e))
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
