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
        console.log("🧹 Clearing existing banners and page content promos...");
        yield prisma.banner.deleteMany({});
        yield prisma.pageContent.deleteMany({
            where: {
                slug: "promos"
            }
        });
        const firstCategory = (yield prisma.category.findFirst({
            where: { slug: { in: ["fruits", "vegetable", "leafy-vegetable"] } }
        })) || (yield prisma.category.findFirst({
            where: { isActive: true }
        }));
        console.log("🌱 Seeding exact banners...");
        yield prisma.banner.createMany({
            data: [
                {
                    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800",
                    link: firstCategory ? `/category/${firstCategory.id}` : "/category/all",
                    isActive: true,
                    sortOrder: 1,
                    position: "HOME_TOP",
                    title: "Daily Essentials",
                    subtitle: "Wide range of exotic fresh produce",
                    redirectType: "category",
                    redirectId: (firstCategory === null || firstCategory === void 0 ? void 0 : firstCategory.id) || "all",
                    buttonText: "SHOP NOW",
                    priority: 1
                },
                {
                    imageUrl: "https://images.unsplash.com/photo-1608686207856-001b95cf60ca?auto=format&fit=crop&q=80&w=800",
                    link: "/offers",
                    isActive: true,
                    sortOrder: 2,
                    position: "HOME_TOP",
                    title: "Super Saver Deals",
                    subtitle: "Extra ₹100 Cashback on your first order",
                    redirectType: "coupon",
                    redirectId: "SAVE100",
                    buttonText: "CLAIM OFFER",
                    priority: 2
                }
            ]
        });
        console.log("🌱 Seeding exact promos...");
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
        console.log("🌱 Seeding popular searches history to get rotating placeholders...");
        const user = (yield prisma.user.findFirst({
            where: { role: "ADMIN" }
        })) || (yield prisma.user.findFirst());
        if (user) {
            yield prisma.searchHistory.deleteMany({
                where: {
                    query: {
                        in: ["Milk", "Eggs", "Fruits"]
                    }
                }
            });
            yield prisma.searchHistory.createMany({
                data: [
                    { userId: user.id, query: "Milk", count: 100 },
                    { userId: user.id, query: "Eggs", count: 90 },
                    { userId: user.id, query: "Fruits", count: 80 }
                ]
            });
        }
        console.log("✨ Reseed complete!");
    });
}
main().catch(console.error).finally(() => pool.end());
