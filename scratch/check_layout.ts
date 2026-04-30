import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { email: true, layout: true } });
  for (const user of users) {
    console.log(`User: ${user.email}, typeof layout: ${typeof user.layout}, isArray: ${Array.isArray(user.layout)}`);
    console.log(JSON.stringify(user.layout, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
