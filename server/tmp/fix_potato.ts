import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const potato = await prisma.product.findFirst({
        where: { name: { contains: 'Potato', mode: 'insensitive' } },
        include: { variants: true, inventory: true }
    });

    console.log('--- POTATO DATA AUDIT ---');
    if (!potato) {
        console.log('Not found');
        return;
    }

    console.log('Product Name:', potato.name);
    console.log('Base Price:', potato.basePrice);
    console.log('Variants:', potato.variants.length);
    potato.variants.forEach(v => {
        console.log(`- Variant: ${v.name}, Price: ${v.price}`);
    });

    // Attempt fix if missing
    if (potato.basePrice === null || Number(potato.basePrice) === 0) {
        console.log('UPDATING PRICE TO 65 FOR POTATO...');
        await prisma.product.update({
            where: { id: potato.id },
            data: { basePrice: 65 }
        });
        console.log('Base price updated.');
    }

    if (potato.variants.length > 0) {
        for (const v of potato.variants) {
            if (v.price === null || Number(v.price) === 0) {
                console.log(`UPDATING PRICE TO 65 FOR VARIANT ${v.name}...`);
                await prisma.productVariant.update({
                    where: { id: v.id },
                    data: { price: 65 }
                });
                console.log(`Variant ${v.name} price updated.`);
            }
        }
    }
}

main().finally(() => prisma.$disconnect());
