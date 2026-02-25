/**
 * fix-images-final.ts
 * Run with: node -r ts-node/register -r dotenv/config prisma/fix-images-final.ts
 *
 * Patches ALL products (by name) and ALL banners to use reliable picsum.photos images.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Map product name substring → picsum seed URL
const NAME_TO_IMAGE: Array<{ match: string; url: string }> = [
    { match: "Potato", url: "https://picsum.photos/seed/potato/500/500" },
    { match: "Onion", url: "https://picsum.photos/seed/onion/500/500" },
    { match: "Garlic", url: "https://picsum.photos/seed/garlic/500/500" },
    { match: "Coriander", url: "https://picsum.photos/seed/coriander/500/500" },
    { match: "Curry Leaves", url: "https://picsum.photos/seed/curryleaves/500/500" },
    { match: "Dill", url: "https://picsum.photos/seed/dillherb/500/500" },
    { match: "Fenugreek", url: "https://picsum.photos/seed/fenugreek/500/500" },
    { match: "Lemon Grass", url: "https://picsum.photos/seed/lemongrass/500/500" },
    { match: "Mint", url: "https://picsum.photos/seed/mintleaf/500/500" },
    { match: "Spring Onion", url: "https://picsum.photos/seed/springonion/500/500" },
    { match: "Red Amaranth", url: "https://picsum.photos/seed/redamaranth/500/500" },
    { match: "Green Amaranth", url: "https://picsum.photos/seed/greenamaranth/500/500" },
    { match: "Pairi Mango", url: "https://picsum.photos/seed/pairimango/500/500" },
    { match: "Devgad Hapus", url: "https://picsum.photos/seed/hapusmango/500/500" },
    { match: "Lalbag Mango", url: "https://picsum.photos/seed/lalbagmango/500/500" },
    { match: "Valencia Orange", url: "https://picsum.photos/seed/orangefruit/500/500" },
    { match: "Sweet Lime", url: "https://picsum.photos/seed/sweetlime/500/500" },
    { match: "Pomegranate", url: "https://picsum.photos/seed/pomegranate/500/500" },
];

const BANNER_IMAGES = [
    "https://picsum.photos/seed/vegetablebanner/1200/400",
    "https://picsum.photos/seed/fruitbanner/1200/400",
    "https://picsum.photos/seed/leafybanner/1200/400",
];

async function main() {
    console.log("🔧 Final image fix — patching all products by name and all banners...\n");

    // ── Products ──────────────────────────────────────────────────────────────
    const products = await prisma.product.findMany({ select: { id: true, name: true, images: true } });

    let updated = 0, alreadyGood = 0, unmatched = 0;

    for (const product of products) {
        const currentImage = (product.images as string[])[0] ?? "";

        // Skip if already using picsum
        if (currentImage.includes("picsum.photos")) {
            alreadyGood++;
            continue;
        }

        const mapping = NAME_TO_IMAGE.find(m => product.name.toLowerCase().includes(m.match.toLowerCase()));
        if (!mapping) {
            console.log(`  ⚠️  No mapping for: "${product.name}" — using default`);
            await prisma.product.update({
                where: { id: product.id },
                data: { images: [`https://picsum.photos/seed/${encodeURIComponent(product.name)}/500/500`] },
            });
            unmatched++;
            continue;
        }

        await prisma.product.update({
            where: { id: product.id },
            data: { images: [mapping.url] },
        });
        console.log(`  ✅ ${product.name}`);
        updated++;
    }

    console.log(`\nProducts: ✅ ${updated} updated, ⬜ ${alreadyGood} already good, ⚠️ ${unmatched} unmatched`);

    // ── Banners ───────────────────────────────────────────────────────────────
    console.log("\n🖼️  Fixing banner images...");
    const banners = await prisma.banner.findMany({ orderBy: { sortOrder: "asc" } });

    for (let i = 0; i < banners.length; i++) {
        const newImageUrl = BANNER_IMAGES[i % BANNER_IMAGES.length];
        await prisma.banner.update({
            where: { id: banners[i].id },
            data: { imageUrl: newImageUrl },
        });
        console.log(`  ✅ Banner #${i + 1} → ${newImageUrl}`);
    }

    console.log("\n🚀 All done!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
