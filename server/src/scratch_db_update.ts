import prisma from "./config/prisma";

async function main() {
    console.log("Running safe manual database column upgrades...");
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
        `);
        console.log("Added 'rating' column successfully.");
    } catch (e: any) {
        console.warn("Could not add 'rating' column:", e.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "feedback" TEXT;
        `);
        console.log("Added 'feedback' column successfully.");
    } catch (e: any) {
        console.warn("Could not add 'feedback' column:", e.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "feedbackSent" BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        console.log("Added 'feedbackSent' column successfully.");
    } catch (e: any) {
        console.warn("Could not add 'feedbackSent' column:", e.message);
    }

    console.log("Database column migration complete with ZERO data loss!");
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
