import prisma from "../src/config/prisma";
async function main() {
    try {
        const count = await prisma.inventoryLog.count();
        console.log("Log count:", count);
    } catch (e: any) {
        console.error("Prisma Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
