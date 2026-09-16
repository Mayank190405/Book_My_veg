
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    console.log("🚀 Initializing Production Seed (Zero Data Mode)...");

    // 1. Create Essential Measurement Units
    const initialUnits = [
        { name: 'Kilogram', symbol: 'KG' },
        { name: 'Gram', symbol: 'GM' },
        { name: 'Liter', symbol: 'LTR' },
        { name: 'Milliliter', symbol: 'ML' },
        { name: 'Piece', symbol: 'PIECE' },
        { name: 'Packet', symbol: 'PACKET' },
    ];

    for (const unit of initialUnits) {
        await prisma.unit.upsert({
            where: { name: unit.name },
            update: {},
            create: {
                name: unit.name,
                symbol: unit.symbol,
                isActive: true,
            },
        });
    }
    console.log("✅ Measurement units operational");

    // 2. Create Initial Store Location (Book My Veg Anandwali, Nashik)
    const store = await prisma.location.upsert({
        where: { slug: "book-my-veg" },
        update: {
            name: "Book My Veg",
            address: "Book My Veg, Anandwali, Gangapur Road, Nashik, Maharashtra 422001",
            contactNumber: "9999999999",
            latitude: 20.0082305,
            longitude: 73.7349024,
            deliveryRadius: 15.0,
            isOpen: true,
            receiptHeader: "Book My Veg - Fresh Vegetables & Fruits",
            receiptFooter: "Thank you for shopping farm-fresh with Book My Veg!"
        },
        create: {
            name: "Book My Veg",
            slug: "book-my-veg",
            address: "Book My Veg, Anandwali, Gangapur Road, Nashik, Maharashtra 422001",
            contactNumber: "9999999999",
            latitude: 20.0082305,
            longitude: 73.7349024,
            deliveryRadius: 15.0,
            isOpen: true,
            receiptHeader: "Book My Veg - Fresh Vegetables & Fruits",
            receiptFooter: "Thank you for shopping farm-fresh with Book My Veg!"
        },
    });
    console.log("✅ Book My Veg Store established (Nashik)");

    // 3. Create Root Super Admin
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    await prisma.user.upsert({
        where: { phone: "9999999999" },
        update: {
            password: hashedPassword,
            role: Role.ADMIN,
        },
        create: {
            phone: "9999999999",
            email: "admin@bookmyveg.com",
            name: "Super Admin",
            role: Role.ADMIN,
            password: hashedPassword,
            isActive: true,
        }
    });

    console.log("✅ Super Admin account created");
    console.log("-----------------------------------------");
    console.log("USER: 9999999999");
    console.log("PASS: admin123");
    console.log("-----------------------------------------");
    console.log("🌱 Database is now ready for deployment.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
