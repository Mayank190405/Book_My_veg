import prisma from "./config/prisma";

async function main() {
    const phone = "8208363287";
    const cleanPhone = phone.replace(/\D/g, "");

    console.log(`Searching for users with phone containing or matching "${phone}"...`);
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { phone: cleanPhone },
                { phone: `91${cleanPhone}` },
                { phone: { contains: cleanPhone } }
            ]
        },
        include: {
            addresses: true
        }
    });

    console.log(`Found ${users.length} user(s):`);
    console.log(JSON.stringify(users, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
