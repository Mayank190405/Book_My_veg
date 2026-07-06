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
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
require("dotenv/config");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🧹 Wiping database tables for clean exact seeding...");
        // Relational deletions using CASCADE
        try {
            yield prisma.$executeRawUnsafe(`TRUNCATE TABLE "Product", "Category", "Banner", "SearchHistory" CASCADE;`);
        }
        catch (e) {
            console.warn("Cascade truncate failed, falling back to manual deleteMany:", e);
            yield prisma.inventory.deleteMany({});
            yield prisma.pricing.deleteMany({});
            yield prisma.cartItem.deleteMany({});
            yield prisma.orderItem.deleteMany({});
            yield prisma.review.deleteMany({});
            yield prisma.sectionProduct.deleteMany({});
            yield prisma.productVariant.deleteMany({});
            yield prisma.product.deleteMany({});
            yield prisma.category.deleteMany({});
            yield prisma.banner.deleteMany({});
            yield prisma.searchHistory.deleteMany({});
        }
        yield prisma.pageContent.deleteMany({ where: { slug: "promos" } });
        console.log("🌱 Seeding Categories matching the UI screenshot exactly...");
        // Create Categories with Unsplash image paths
        const catOil = yield prisma.category.create({
            data: {
                name: "OIL & GHEE",
                slug: "oil",
                imageUrl: "/images/category_oil.png",
                icon: "Great Quality Oils At Best Prices",
                isActive: true,
                sortOrder: 1
            }
        });
        const catGrains = yield prisma.category.create({
            data: {
                name: "GRAINS & PULSES",
                slug: "grains",
                imageUrl: "/images/category_grains.png",
                icon: "Premium Grains For Healthy Life",
                isActive: true,
                sortOrder: 2
            }
        });
        const catDairy = yield prisma.category.create({
            data: {
                name: "DAIRY & EGGS",
                slug: "dairy",
                imageUrl: "/images/category_dairy.png",
                icon: "Pure & Fresh Dairy Products",
                isActive: true,
                sortOrder: 3
            }
        });
        const catFruits = yield prisma.category.create({
            data: {
                name: "FRUITS & VEGETABLES",
                slug: "fruits",
                imageUrl: "/images/category_fruits.png",
                icon: "Farm Fresh Always",
                isActive: true,
                sortOrder: 4
            }
        });
        const catPersonal = yield prisma.category.create({
            data: {
                name: "PERSONAL CARE",
                slug: "personal-care",
                imageUrl: "/images/category_personal.png",
                icon: "Boutique health choices",
                isActive: true,
                sortOrder: 5
            }
        });
        const catPackaged = yield prisma.category.create({
            data: {
                name: "PACKAGED FOODS",
                slug: "packaged-foods",
                imageUrl: "/images/category_packaged.png",
                icon: "Pure goodness guaranteed",
                isActive: true,
                sortOrder: 6
            }
        });
        console.log("✅ Categories created.");
        // Fetch or create location (store)
        const location = (yield prisma.location.findFirst({
            where: { slug: "main-hub" }
        })) || (yield prisma.location.create({
            data: {
                name: "Main Hub",
                slug: "main-hub",
                address: "Primary Distribution Center",
                latitude: 28.6139,
                longitude: 77.2090
            }
        }));
        console.log(`📍 Inventory linked to Location: ${location.name} (${location.id})`);
        console.log("🌱 Seeding products matching the UI screenshot exactly...");
        // Helper function to create product, variant, pricing, and inventory
        const createExactProduct = (name, slug, categoryId, imageUrl, price, weightVal, weightUnit, variantName, sku, barcode) => __awaiter(this, void 0, void 0, function* () {
            const prod = yield prisma.product.create({
                data: {
                    name,
                    slug,
                    categoryId,
                    images: [imageUrl],
                    basePrice: price,
                    weightUnit: weightUnit,
                    isActive: true,
                    isWebsitePublished: true,
                    sku,
                    barcode
                }
            });
            const variant = yield prisma.productVariant.create({
                data: {
                    productId: prod.id,
                    name: variantName,
                    price: price,
                    weight: weightVal,
                    weightUnit: weightUnit,
                    isActive: true
                }
            });
            yield prisma.pricing.create({
                data: {
                    productId: prod.id,
                    variantId: variant.id,
                    channel: client_1.Channel.WEB,
                    price: price,
                    isActive: true
                }
            });
            yield prisma.inventory.create({
                data: {
                    productId: prod.id,
                    variantId: variant.id,
                    locationId: location.id,
                    currentStock: 500,
                    thresholdStock: 5
                }
            });
            return prod;
        });
        // 1. Apple Red (1 kg, ₹129, category fruits)
        yield createExactProduct("Apple Red", "apple-red", catFruits.id, "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?q=80&w=300&auto=format&fit=crop", 129, 1, client_1.WeightUnit.KG, "1 kg", "SKU-APPLE-RED", "BARCODE-APPLE-RED");
        // 2. Amul Milk (1 L, ₹56, category dairy)
        yield createExactProduct("Amul Milk", "amul-milk", catDairy.id, "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=300&auto=format&fit=crop", 56, 1, client_1.WeightUnit.LTR, "1 L", "SKU-AMUL-MILK", "BARCODE-AMUL-MILK");
        // 3. Farm Eggs (6 pcs, ₹40, category dairy)
        yield createExactProduct("Farm Eggs", "farm-eggs", catDairy.id, "https://images.unsplash.com/photo-1587486913049-53fc88980cfc?q=80&w=300&auto=format&fit=crop", 40, 6, client_1.WeightUnit.PIECE, "6 pcs", "SKU-FARM-EGGS", "BARCODE-FARM-EGGS");
        // 4. Yellow Banana (1 kg, ₹42, category fruits)
        yield createExactProduct("Yellow Banana", "yellow-banana", catFruits.id, "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=300&auto=format&fit=crop", 42, 1, client_1.WeightUnit.KG, "1 kg", "SKU-YELLOW-BANANA", "BARCODE-YELLOW-BANANA");
        console.log("✅ Products created.");
        console.log("🌱 Seeding Hero Banners...");
        yield prisma.banner.createMany({
            data: [
                {
                    imageUrl: "/images/fresh_produce_banner.png",
                    link: `/category/${catFruits.id}`,
                    isActive: true,
                    sortOrder: 1,
                    position: "HOME_TOP",
                    title: "Organic Freshness",
                    subtitle: "Get farm-fresh organic vegetables & fruits delivered in 10 mins",
                    redirectType: "category",
                    redirectId: catFruits.id,
                    buttonText: "SHOP NOW",
                    priority: 1
                },
                {
                    imageUrl: "/images/dairy_eggs_banner.png",
                    link: `/category/${catDairy.id}`,
                    isActive: true,
                    sortOrder: 2,
                    position: "HOME_TOP",
                    title: "Dairy & Breakfast",
                    subtitle: "Fresh milk, butter, cheese, and farm eggs to start your day",
                    redirectType: "category",
                    redirectId: catDairy.id,
                    buttonText: "ORDER NOW",
                    priority: 2
                },
                {
                    imageUrl: "/images/gourmet_essentials_banner.png",
                    link: `/category/${catOil.id}`,
                    isActive: true,
                    sortOrder: 3,
                    position: "HOME_TOP",
                    title: "Premium Cooking",
                    subtitle: "Cold-pressed oils, pure cow ghee, pulses, and organic spices",
                    redirectType: "category",
                    redirectId: catOil.id,
                    buttonText: "EXPLORE",
                    priority: 3
                }
            ]
        });
        console.log("🌱 Seeding Page Promos...");
        yield prisma.pageContent.create({
            data: {
                slug: "promos",
                title: "Promotional Offers",
                content: JSON.stringify([
                    {
                        "id": "promo-1",
                        "type": "FREE_DELIVERY",
                        "title": "FREE DELIVERY",
                        "subtitle": "On orders above ₹499",
                        "icon": "Percent",
                        "link": "/offers/free-delivery"
                    },
                    {
                        "id": "promo-2",
                        "type": "EXPRESS_DELIVERY",
                        "title": "EXPRESS DELIVERY",
                        "subtitle": "10-20 mins delivery",
                        "icon": "Truck",
                        "link": "/offers/express-delivery"
                    }
                ], null, 2)
            }
        });
        console.log("🌱 Seeding Popular Search Terms...");
        // Find or create admin user for search history links
        const adminUser = (yield prisma.user.findFirst({
            where: { role: client_1.Role.ADMIN }
        })) || (yield prisma.user.findFirst());
        if (adminUser) {
            yield prisma.searchHistory.createMany({
                data: [
                    { userId: adminUser.id, query: "Milk", count: 100 },
                    { userId: adminUser.id, query: "Eggs", count: 90 },
                    { userId: adminUser.id, query: "Fruits", count: 80 }
                ]
            });
        }
        console.log("✨ Database populated with exact mockup data!");
    });
}
main()
    .catch(console.error)
    .finally(() => pool.end());
