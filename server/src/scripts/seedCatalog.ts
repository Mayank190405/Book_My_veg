import "dotenv/config";
import { basePrisma as prisma } from "../config/prisma";

async function seedCatalog() {
    console.log("🌱 Checking Book My Veg product catalog...");

    console.log("Seeding farm-fresh vegetables, fruits, and essentials catalog...");

    // 1. Ensure Location
    let location = await prisma.location.findFirst({ where: { slug: "book-my-veg" } });
    if (!location) {
        location = await prisma.location.create({
            data: {
                slug: "book-my-veg",
                name: "Book My Veg (Nashik Hub)",
                address: "Anandwali, Gangapur Road, Nashik, Maharashtra 422001",
                contactNumber: "9876543210",
                latitude: 20.0082305,
                longitude: 73.7349024,
                deliveryRadius: 15.0,
                isOpen: true,
            }
        });
    }

    // 2. Categories
    const categoriesData = [
        { name: "Fresh Vegetables", slug: "fresh-vegetables", icon: "Carrot" },
        { name: "Daily Essentials", slug: "daily-essentials", icon: "ShoppingBag" },
        { name: "Farm Fruits", slug: "farm-fruits", icon: "Apple" },
        { name: "Herbs & Seasoning", slug: "herbs-seasoning", icon: "Leaf" },
        { name: "Exotic Vegetables", slug: "exotic-vegetables", icon: "Sparkles" },
    ];

    const categoryMap = new Map<string, string>();
    for (const cat of categoriesData) {
        const created = await prisma.category.upsert({
            where: { slug: cat.slug },
            update: {},
            create: {
                name: cat.name,
                slug: cat.slug,
                icon: cat.icon,
                isActive: true,
            }
        });
        categoryMap.set(cat.slug, created.id);
    }

    // 3. Products List
    const productsData = [
        {
            name: "Fresh Green Chili (Hari Mirchi)",
            slug: "fresh-green-chili",
            categorySlug: "herbs-seasoning",
            basePrice: 15,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80"],
            description: "Freshly harvested spicy Indian green chilies. Crisp, vibrant, and packed with flavor for curries, tadkas, and chutneys.",
            tags: ["chili", "chilli", "green chili", "hari mirchi", "mirchi", "spicy", "hot", "seasoning", "tadka", "indian spices"],
            variants: [
                { name: "100g Pack", price: 15, weight: 100, weightUnit: "GM" },
                { name: "250g Pack", price: 32, weight: 250, weightUnit: "GM" },
                { name: "500g Pack", price: 60, weight: 500, weightUnit: "GM" },
            ]
        },
        {
            name: "Desi Tomato (Tamatar)",
            slug: "desi-tomato",
            categorySlug: "fresh-vegetables",
            basePrice: 28,
            weightUnit: "KG",
            images: ["https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80"],
            description: "Tangy, juicy Nashik desi farm tomatoes. Ideal for rich gravies, salads, and Indian rasam.",
            tags: ["tomato", "tamatar", "desi tomato", "tometo", "salad", "gravy", "curry", "sour", "vegetables"],
            variants: [
                { name: "500g", price: 15, weight: 500, weightUnit: "GM" },
                { name: "1 kg", price: 28, weight: 1000, weightUnit: "GM" },
                { name: "2 kg Family Pack", price: 52, weight: 2000, weightUnit: "GM" },
            ]
        },
        {
            name: "Fresh Potato (Aloo / Batata)",
            slug: "fresh-potato",
            categorySlug: "daily-essentials",
            basePrice: 35,
            weightUnit: "KG",
            images: ["https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80"],
            description: "Firm, freshly sorted potatoes with thin skin. Perfect for crispy fries, sabzi, samosas, and curries.",
            tags: ["potato", "aloo", "alu", "batata", "potatoes", "fries", "starchy", "daily essentials", "staples", "samosa"],
            variants: [
                { name: "1 kg", price: 35, weight: 1000, weightUnit: "GM" },
                { name: "2 kg", price: 68, weight: 2000, weightUnit: "GM" },
                { name: "5 kg Bag", price: 160, weight: 5000, weightUnit: "GM" },
            ]
        },
        {
            name: "Red Onion (Pyaaz / Kanda)",
            slug: "red-onion",
            categorySlug: "daily-essentials",
            basePrice: 38,
            weightUnit: "KG",
            images: ["https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80"],
            description: "Nashik premium red onions with crisp texture and sweet, pungent aroma. Fundamental base for all Indian cooking.",
            tags: ["onion", "pyaaz", "pyaz", "kanda", "onions", "nashik onion", "salad", "essentials", "tadka", "gravy"],
            variants: [
                { name: "1 kg", price: 38, weight: 1000, weightUnit: "GM" },
                { name: "2 kg", price: 72, weight: 2000, weightUnit: "GM" },
                { name: "5 kg Saver Bag", price: 175, weight: 5000, weightUnit: "GM" },
            ]
        },
        {
            name: "Fresh Palak (Spinach Leaves)",
            slug: "fresh-palak-spinach",
            categorySlug: "fresh-vegetables",
            basePrice: 22,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80"],
            description: "Tender, dark green spinach bunches harvested daily. Rich in iron, vitamins, and antioxidants. Great for Palak Paneer and green smoothies.",
            tags: ["palak", "spinach", "leafy", "green leafy", "healthy", "iron", "greens", "soup"],
            variants: [
                { name: "1 Bunch (Approx 250g)", price: 22, weight: 250, weightUnit: "GM" },
                { name: "2 Bunches (500g)", price: 40, weight: 500, weightUnit: "GM" },
            ]
        },
        {
            name: "Fresh Coriander Leaves (Kothimbir / Dhaniya)",
            slug: "fresh-coriander-dhaniya",
            categorySlug: "herbs-seasoning",
            basePrice: 15,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&auto=format&fit=crop&q=80"],
            description: "Aromatic farm-fresh coriander bunch with roots intact for lasting freshness. Essential garnish and chutney staple.",
            tags: ["coriander", "dhaniya", "dhania", "kothimbir", "cilantro", "herbs", "chutney", "garnish", "fresh herbs"],
            variants: [
                { name: "100g Bunch", price: 15, weight: 100, weightUnit: "GM" },
                { name: "250g Bunch", price: 30, weight: 250, weightUnit: "GM" },
            ]
        },
        {
            name: "Tender Lady Finger (Bhindi / Okra)",
            slug: "tender-lady-finger-bhindi",
            categorySlug: "fresh-vegetables",
            basePrice: 30,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=600&auto=format&fit=crop&q=80"],
            description: "Slender, crisp, fiber-free tender bhindi. Perfect for crispy kurkuri bhindi and masala stir-fry.",
            tags: ["bhindi", "bhendi", "okra", "ladyfinger", "lady finger", "green vegetable", "kurkuri bhindi"],
            variants: [
                { name: "250g Pack", price: 30, weight: 250, weightUnit: "GM" },
                { name: "500g Pack", price: 58, weight: 500, weightUnit: "GM" },
            ]
        },
        {
            name: "Green Bell Pepper (Shimla Mirchi / Capsicum)",
            slug: "green-bell-pepper-capsicum",
            categorySlug: "fresh-vegetables",
            basePrice: 35,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80"],
            description: "Crunchy green bell peppers with a glossy shine. Essential for Chinese fried rice, pizza, noodles, and paneer tikka.",
            tags: ["capsicum", "shimla mirchi", "bell pepper", "green pepper", "salad", "pizza", "paneer tikka", "chinese"],
            variants: [
                { name: "250g Pack", price: 35, weight: 250, weightUnit: "GM" },
                { name: "500g Pack", price: 65, weight: 500, weightUnit: "GM" },
            ]
        },
        {
            name: "Fresh Ginger & Garlic Combo (Adrak-Lahsun)",
            slug: "fresh-ginger-garlic-combo",
            categorySlug: "herbs-seasoning",
            basePrice: 45,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80"],
            description: "Handpicked spicy ginger roots and bold white garlic cloves. The ultimate aromatic duo for all curries and gravies.",
            tags: ["ginger", "garlic", "adrak", "lahsun", "adrak lahsun", "paste", "immunity", "herbs", "flavor", "tadka"],
            variants: [
                { name: "Combo Pack (100g Ginger + 100g Garlic)", price: 45, weight: 200, weightUnit: "GM" },
                { name: "Ginger Only 250g", price: 40, weight: 250, weightUnit: "GM" },
                { name: "Garlic Only 250g", price: 50, weight: 250, weightUnit: "GM" },
            ]
        },
        {
            name: "Juicy Yellow Lemons (Nimbu)",
            slug: "juicy-yellow-lemons",
            categorySlug: "farm-fruits",
            basePrice: 20,
            weightUnit: "PIECE",
            images: ["https://images.unsplash.com/photo-1590502593747-42a996133562?w=600&auto=format&fit=crop&q=80"],
            description: "Seed-rich, thin-skinned juicy yellow lemons. Packed with Vitamin C for fresh lemonade, salad dressings, and digestion.",
            tags: ["lemon", "nimbu", "lime", "citrus", "vitamin c", "juice", "lemonade", "refreshing", "salad"],
            variants: [
                { name: "4 Pieces Pack", price: 20, weight: 150, weightUnit: "GM" },
                { name: "8 Pieces Value Pack", price: 38, weight: 300, weightUnit: "GM" },
            ]
        },
        {
            name: "Fresh Green Peas (Matar)",
            slug: "fresh-green-peas-matar",
            categorySlug: "fresh-vegetables",
            basePrice: 45,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=600&auto=format&fit=crop&q=80"],
            description: "Sweet, tender whole green peas pods freshly picked from Maharashtra fields. Perfect for Matar Paneer and pulao.",
            tags: ["peas", "matar", "green peas", "vatana", "sweet peas", "matar paneer", "pulao"],
            variants: [
                { name: "500g Pods", price: 45, weight: 500, weightUnit: "GM" },
                { name: "1 kg Pods", price: 85, weight: 1000, weightUnit: "GM" },
            ]
        },
        {
            name: "Sweet Shimla Apples (Royal Delicious)",
            slug: "sweet-shimla-apples",
            categorySlug: "farm-fruits",
            basePrice: 140,
            weightUnit: "KG",
            images: ["https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80"],
            description: "Crisp, naturally sweet Royal Delicious apples sourced directly from Himachal orchards. Wax-free and juicy.",
            tags: ["apple", "seb", "apples", "shimla apple", "fruits", "healthy", "sweet", "breakfast", "fiber"],
            variants: [
                { name: "500g (Approx 3-4 apples)", price: 75, weight: 500, weightUnit: "GM" },
                { name: "1 kg (Approx 6-7 apples)", price: 140, weight: 1000, weightUnit: "GM" },
            ]
        },
        {
            name: "Fresh Malai Paneer (Cottage Cheese)",
            slug: "fresh-malai-paneer",
            categorySlug: "daily-essentials",
            basePrice: 90,
            weightUnit: "GM",
            images: ["https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80"],
            description: "Super soft, melt-in-the-mouth farm fresh malai paneer. Made daily from pure buffalo milk, vacuum packed for freshness.",
            tags: ["paneer", "malai paneer", "cottage cheese", "dairy", "protein", "fresh paneer"],
            variants: [
                { name: "200g Pack", price: 90, weight: 200, weightUnit: "GM" },
                { name: "500g Value Pack", price: 210, weight: 500, weightUnit: "GM" },
                { name: "1 kg Bulk Pack", price: 400, weight: 1000, weightUnit: "GM" },
            ]
        },
        {
            name: "Farm Fresh Cow Milk (Full Cream)",
            slug: "farm-fresh-cow-milk",
            categorySlug: "daily-essentials",
            basePrice: 34,
            weightUnit: "LTR",
            images: ["https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80"],
            description: "Pasteurized, farm-fresh pure cow milk pouch delivered chilled within hours of morning milking.",
            tags: ["milk", "cow milk", "doodh", "dudh", "fresh milk", "dairy", "calcium"],
            variants: [
                { name: "500ml Pouch", price: 34, weight: 500, weightUnit: "ML" },
                { name: "1 Liter Pouch", price: 66, weight: 1000, weightUnit: "ML" },
            ]
        }
    ];

    for (const item of productsData) {
        const categoryId = categoryMap.get(item.categorySlug);
        if (!categoryId) continue;

        const existing = await prisma.product.findUnique({ where: { slug: item.slug } });
        if (existing) {
            // Update tags if needed
            await prisma.product.update({
                where: { id: existing.id },
                data: { tags: item.tags }
            });
            continue;
        }

        const product = await prisma.product.create({
            data: {
                name: item.name,
                slug: item.slug,
                description: item.description,
                categoryId: categoryId,
                images: item.images,
                basePrice: item.basePrice,
                isActive: true,
                tags: item.tags,
                isWebsitePublished: true,
                variants: {
                    create: item.variants.map((v) => ({
                        name: v.name,
                        price: v.price,
                        weight: v.weight,
                        weightUnit: v.weightUnit as any,
                        isActive: true,
                    }))
                },
                pricing: {
                    create: {
                        price: item.basePrice,
                        channel: "WEB",
                        isActive: true
                    }
                },
                inventory: {
                    create: {
                        locationId: location.id,
                        currentStock: 100,
                        thresholdStock: 10,
                    }
                }
            }
        });

        console.log(`✅ Seeded: ${product.name}`);
    }

    console.log("🎉 Successfully seeded farm-fresh Book My Veg catalog!");
}

seedCatalog()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
