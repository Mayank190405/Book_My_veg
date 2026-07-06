// server/src/scripts/createAdmin.ts

import prisma from "../config/prisma";
import bcrypt from "bcryptjs";

async function main() {
    const phone = process.argv[2] || "9999999999";
    const password = process.argv[3] || "adminPassword123";
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { phone },
        update: {
            role: "ADMIN",
            password: hashedPassword,
            isActive: true
        },
        create: {
            phone,
            role: "ADMIN",
            password: hashedPassword,
            isActive: true,
            name: "Local Admin"
        }
    });

    console.log(`✅ Admin user ${user.phone} created/updated.`);
    console.log(`🔑 Login locally at http://localhost:3000/login`);
    console.log(`📱 Phone: ${phone}`);
    console.log(`🔒 Password: ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
