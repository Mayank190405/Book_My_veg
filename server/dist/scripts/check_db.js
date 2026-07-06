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
function check() {
    return __awaiter(this, void 0, void 0, function* () {
        const products = yield prisma.product.findMany({
            include: {
                inventory: true,
                batch: true
            }
        });
        console.log(`Found ${products.length} products.`);
        products.forEach((p) => {
            console.log(`Product: ${p.name} (ID: ${p.id}, SKU: ${p.sku})`);
            console.log(`- Inventory:`, p.inventory);
            console.log(`- Batches:`, p.batch.map((b) => ({
                id: b.id,
                locationId: b.locationId,
                remainingQty: b.remainingQty.toString(),
                batchNumber: b.batchNumber
            })));
        });
        const locations = yield prisma.location.findMany();
        console.log(`\nFound ${locations.length} locations.`);
        locations.forEach(l => {
            console.log(`Location: ${l.name} (ID: ${l.id}, Slug: ${l.slug})`);
        });
        const users = yield prisma.user.findMany();
        console.log(`\nFound ${users.length} users.`);
    });
}
check()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
