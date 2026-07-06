const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const packer = await prisma.user.upsert({
    where: { phone: '9999911111' },
    update: {},
    create: {
      id: "test-packer-uuid",
      phone: '9999911111',
      name: 'Test Packer',
      role: 'PACKING',
      isActive: true,
    },
  })
  
  const driver = await prisma.user.upsert({
    where: { phone: '9999922222' },
    update: {},
    create: {
      id: "test-driver-uuid",
      phone: '9999922222',
      name: 'Test Driver',
      role: 'DELIVERY_PARTNER',
      isActive: true,
    },
  })

  console.log('Logistics users created successfully')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
