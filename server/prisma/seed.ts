import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { WeightUnit, BannerPosition } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    console.log("🌱 Starting database seed...");

    // 1. Clean existing data (optional - careful in prod)
    // await prisma.orderItem.deleteMany();
    // await prisma.cartItem.deleteMany();
    // await prisma.sectionProduct.deleteMany();
    // await prisma.inventory.deleteMany();
    // await prisma.pricing.deleteMany();
    // await prisma.productVariant.deleteMany();
    // await prisma.product.deleteMany();
    // await prisma.category.deleteMany();
    // await prisma.banner.deleteMany();
    // console.log("🧹 Cleaned up existing data");

    // 2. Create Categories
    const catVegetables = await prisma.category.create({
        data: {
            name: "Vegetables",
            slug: "vegetables",
            icon: "https://cdn-icons-png.flaticon.com/512/2329/2329903.png", // Carrot icon
            isActive: true,
            sortOrder: 1,
        },
    });

    const catLeafy = await prisma.category.create({
        data: {
            name: "Leafy Vegetables",
            slug: "leafy-vegetables",
            icon: "https://cdn-icons-png.flaticon.com/512/7230/7230981.png", // Spinach/Leaf icon
            isActive: true,
            sortOrder: 2,
        },
    });

    const catFruits = await prisma.category.create({
        data: {
            name: "Fruits",
            slug: "fruits",
            icon: "https://cdn-icons-png.flaticon.com/512/3194/3194766.png", // Apple icon
            isActive: true,
            sortOrder: 3,
        },
    });

    console.log("✅ Categories created");

    // 3. Create Products
    const productsData = [
        // Vegetables
        {
            name: "Potato (Regular)",
            categoryId: catVegetables.id,
            basePrice: 35,
            weightUnit: WeightUnit.KG,
            description: "Fresh potatoes, 950-1050g pack",
            image: "https://images.unsplash.com/photo-1518977676641-8f396102db09?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Potato (Large Pack)",
            categoryId: catVegetables.id,
            basePrice: 70,
            weightUnit: WeightUnit.KG,
            description: "Fresh potatoes, 1950-2050g pack",
            image: "https://images.unsplash.com/photo-1518977676641-8f396102db09?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Onion (Regular)",
            categoryId: catVegetables.id,
            basePrice: 35,
            weightUnit: WeightUnit.KG,
            description: "Fresh onions, 950-1050g pack",
            image: "https://images.unsplash.com/photo-1508747703725-7197b963371a?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Onion (Large Pack)",
            categoryId: catVegetables.id,
            basePrice: 70,
            weightUnit: WeightUnit.KG,
            description: "Fresh onions, 1900-2050g pack",
            image: "https://images.unsplash.com/photo-1508747703725-7197b963371a?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Garlic",
            categoryId: catVegetables.id,
            basePrice: 25,
            weightUnit: WeightUnit.GM, // 200g
            description: "Fresh garlic, 200g pack",
            image: "https://images.unsplash.com/photo-1615477063529-688df50058e5?auto=format&fit=crop&w=500&q=80",
        },

        // Leafy Vegetables
        {
            name: "Coriander",
            categoryId: catLeafy.id,
            basePrice: 20,
            weightUnit: WeightUnit.PIECE, // 1 judi
            description: "Fresh Coriander bunch",
            image: "https://images.unsplash.com/photo-1588879461626-d68f23f85854?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Curry Leaves",
            categoryId: catLeafy.id,
            basePrice: 10,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Curry Leaves bunch",
            image: "https://post.healthline.com/wp-content/uploads/2020/09/curry-leaves-1200x628-facebook-1200x628.jpg",
        },
        {
            name: "Dill Leaves (Shepu)",
            categoryId: catLeafy.id,
            basePrice: 35,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Dill Leaves bunch",
            image: "https://media.istockphoto.com/id/1151399479/photo/fresh-organic-dill.jpg?s=612x612&w=0&k=20&c=JdF2W6rR8zJ8vI6hG8_q6_z8_5_d_3_6_4_5",
        },
        {
            name: "Fenugreek (Methi)",
            categoryId: catLeafy.id,
            basePrice: 49,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Fenugreek bunch",
            image: "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Lemon Grass",
            categoryId: catLeafy.id,
            basePrice: 10,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Lemon Grass bunch",
            image: "https://images.unsplash.com/photo-1614266679586-5d63f25c7b2d?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Mint (Pudina)",
            categoryId: catLeafy.id,
            basePrice: 15,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Mint bunch",
            image: "https://images.unsplash.com/photo-1628556270448-98402db3e47a?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Spring Onion",
            categoryId: catLeafy.id,
            basePrice: 39,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Spring Onion bunch",
            image: "https://product-images.metro.ca/images/h90/h25/12177579606046.jpg",
        },
        {
            name: "Red Amaranth",
            categoryId: catLeafy.id,
            basePrice: 39,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Red Amaranth bunch",
            image: "https://t3.ftcdn.net/jpg/04/09/99/33/360_F_409993355_k6p6q4k4q4.jpg",
        },
        {
            name: "Green Amaranth",
            categoryId: catLeafy.id,
            basePrice: 39,
            weightUnit: WeightUnit.PIECE,
            description: "Fresh Green Amaranth bunch",
            image: "https://m.media-amazon.com/images/I/71Y-s-c-4HL.jpg",
        },

        // Fruits
        {
            name: "Pairi Mango",
            categoryId: catFruits.id,
            basePrice: 279,
            weightUnit: WeightUnit.KG,
            description: "Fresh Pairi Mango, 950-1050g pack",
            image: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Devgad Hapus",
            categoryId: catFruits.id,
            basePrice: 549,
            weightUnit: WeightUnit.KG,
            description: "Authentic Devgad Hapus Mango, 950-1050g pack",
            image: "https://images.unsplash.com/photo-1591073113125-e46713c829ed?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Lalbag Mango",
            categoryId: catFruits.id,
            basePrice: 249,
            weightUnit: WeightUnit.KG,
            description: "Fresh Lalbag Mango, 950-1050g pack",
            image: "https://images.unsplash.com/photo-1605027582375-72ee3f26f29e?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Valencia Orange",
            categoryId: catFruits.id,
            basePrice: 99,
            weightUnit: WeightUnit.KG, // 450-550g is roughly half kg, but let's assume pack unit
            description: "Fresh Valencia Orange, 450-550g pack",
            image: "https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Sweet Lime (Mosambi)",
            categoryId: catFruits.id,
            basePrice: 69,
            weightUnit: WeightUnit.KG,
            description: "Fresh Sweet Lime, 950-1050g pack",
            image: "https://images.unsplash.com/photo-1592187270271-9a4b84fab9ee?auto=format&fit=crop&w=500&q=80",
        },
        {
            name: "Pomegranate",
            categoryId: catFruits.id,
            basePrice: 180,
            weightUnit: WeightUnit.KG,
            description: "Fresh Pomegranate, 450-600g pack",
            image: "https://images.unsplash.com/photo-1615485925763-867862f83772?auto=format&fit=crop&w=500&q=80",
        }
    ];

    // Helper location
    const location = await prisma.location.create({
        data: {
            name: "Main Warehouse",
            slug: "main-warehouse",
            address: "123 Market St",
        },
    });

    for (const p of productsData) {
        // Generate valid slug
        let slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

        // Ensure uniqueness manually just in case
        const existing = await prisma.product.findUnique({ where: { slug } });
        if (existing) slug = `${slug}-${Math.floor(Math.random() * 1000)}`;

        const product = await prisma.product.create({
            data: {
                name: p.name,
                slug: slug,
                description: p.description,
                categoryId: p.categoryId,
                basePrice: p.basePrice,
                weightUnit: p.weightUnit,
                images: p.image ? [p.image] : [],
                isActive: true,
            },
        });

        // Add weight variants for specific products
        if (p.name.includes("Potato") || p.name.includes("Onion") || p.name.includes("Mango")) {
            const variants = [
                { name: "500g", priceMultiplier: 0.55, weight: 500, unit: WeightUnit.GM },
                { name: "1kg", priceMultiplier: 1.0, weight: 1, unit: WeightUnit.KG },
                { name: "2kg", priceMultiplier: 1.9, weight: 2, unit: WeightUnit.KG },
            ];

            for (const v of variants) {
                const varPrice = Number(p.basePrice) * v.priceMultiplier;
                await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        name: v.name,
                        price: varPrice,
                        weight: v.weight,
                        weightUnit: v.unit,
                        isActive: true,
                    }
                });
            }
        }

        // Add inventory
        await prisma.inventory.create({
            data: {
                productId: product.id,
                locationId: location.id,
                currentStock: Math.floor(Math.random() * 100) + 10,
                thresholdStock: 10,
                isLowStock: false,
            }
        });

        // Add Pricing
        await prisma.pricing.create({
            data: {
                productId: product.id,
                price: p.basePrice,
                startDate: new Date(),
                isActive: true,
            }
        });
    }

    console.log("✅ Products created");

    // 4. Create Banners
    await prisma.banner.createMany({
        data: [
            {
                position: BannerPosition.HOME_TOP,
                imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80", // Market/Veggie spread
                link: "/category/vegetables",
                isActive: true,
                sortOrder: 1,
            },
            {
                position: BannerPosition.HOME_TOP,
                imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1200&q=80", // Fresh Fruits
                link: "/category/fruits",
                isActive: true,
                sortOrder: 2,
            },
            {
                position: BannerPosition.HOME_TOP,
                imageUrl: "https://images.unsplash.com/photo-1506484381205-f7945653044d?auto=format&fit=crop&w=1200&q=80", // Dark leafy greens
                link: "/category/leafy-vegetables",
                isActive: true,
                sortOrder: 3,
            }
        ]
    });

    console.log("✅ Banners created");
    console.log("🚀 Seed completed!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
