import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("FETCHING ADMINISTRATIVE REGISTRY...");
    const admins = await (prisma.user.findMany as any)({
        where: {
            role: {
                in: ["ADMIN", "STORE_ADMIN"]
            }
        },
        select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            location: {
                select: { name: true }
            }
        }
    });

    if (admins.length === 0) {
        console.log("CRITICAL: NO ADMINISTRATIVE NODES DETECTED.");
        console.log("PLEASE REGISTER AN ADMIN VIA OTP FIRST, THEN ELEVATE ROLE.");
    } else {
        console.table(admins.map((a: any) => ({
            "Protocol Name": a.name || "UNNAMED_ASSET",
            "Node ID (Phone)": a.phone,
            "Privilege Class": a.role,
            "Node Status": a.isActive ? "ACTIVE" : "SUSPENDED",
            "Assigned Hub": a.location?.name || "GLOBAL_HQ"
        })));
    }
}

main().finally(async () => {
    await prisma.$disconnect();
});
