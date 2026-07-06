"use strict";
/**
 * fix-all-images.ts
 * Run with: node -r ts-node/register -r dotenv/config prisma/fix-all-images.ts
 *
 * Replaces ALL product images with reliable picsum.photos URLs (seed-based = consistent).
 */
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
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
// Map slug → picsum seed (seed gives consistent, repeatable image)
// Use picsum.photos/seed/<seed>/500/500
const IMAGE_MAP = {
    "potato-regular": "https://picsum.photos/seed/potato1/500/500",
    "potato-large-pack": "https://picsum.photos/seed/potato2/500/500",
    "onion-regular": "https://picsum.photos/seed/onion1/500/500",
    "onion-large-pack": "https://picsum.photos/seed/onion2/500/500",
    "garlic": "https://picsum.photos/seed/garlic/500/500",
    "coriander": "https://picsum.photos/seed/coriander/500/500",
    "curry-leaves": "https://picsum.photos/seed/curryleaves/500/500",
    "dill-leaves-shepu": "https://picsum.photos/seed/dill/500/500",
    "fenugreek-methi": "https://picsum.photos/seed/methi/500/500",
    "lemon-grass": "https://picsum.photos/seed/lemongrass/500/500",
    "mint-pudina": "https://picsum.photos/seed/mint/500/500",
    "spring-onion": "https://picsum.photos/seed/springonion/500/500",
    "red-amaranth": "https://picsum.photos/seed/redamaranth/500/500",
    "green-amaranth": "https://picsum.photos/seed/greenamaranth/500/500",
    "pairi-mango": "https://picsum.photos/seed/pairimango/500/500",
    "devgad-hapus": "https://picsum.photos/seed/hapusmango/500/500",
    "lalbag-mango": "https://picsum.photos/seed/lalbagmango/500/500",
    "valencia-orange": "https://picsum.photos/seed/orange/500/500",
    "sweet-lime-mosambi": "https://picsum.photos/seed/mosambi/500/500",
    "pomegranate": "https://picsum.photos/seed/pomegranate/500/500",
};
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🔧 Fixing ALL product images with reliable picsum.photos URLs...");
        const products = yield prisma.product.findMany({ select: { id: true, name: true, slug: true, images: true } });
        let updated = 0;
        let skipped = 0;
        for (const product of products) {
            const newUrl = IMAGE_MAP[product.slug];
            if (!newUrl) {
                console.log(`  ⚠️  No mapping for slug: "${product.slug}" (${product.name})`);
                skipped++;
                continue;
            }
            yield prisma.product.update({
                where: { id: product.id },
                data: { images: [newUrl] },
            });
            console.log(`  ✅ ${product.name} → ${newUrl}`);
            updated++;
        }
        console.log(`\n🚀 Done! Updated: ${updated}, Skipped: ${skipped}`);
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
