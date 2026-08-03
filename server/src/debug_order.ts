import prisma from "./config/prisma";

async function main() {
    const orderId = "BMVUYPRNZXUX84D";
    console.log(`Inspecting order: ${orderId}`);

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: true,
            payments: true
        }
    });

    console.log("Order Record:");
    console.log(JSON.stringify(order, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
