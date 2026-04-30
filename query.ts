import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const users = await prisma.user.findMany({ select: { name: true, email: true, layout: true } })
  console.log(JSON.stringify(users, null, 2))
}
main().finally(() => prisma.$disconnect())
