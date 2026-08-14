import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const prisma = createPrismaClient();

async function main() {
  console.log('=== Starting Password Hashing Migration (v1.14.0) ===');
  
  // Query all users where legacy password is set and passwordHash is null
  const users = await prisma.user.findMany({
    where: {
      password: { not: null },
      passwordHash: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
    },
  });

  console.log(`Found ${users.length} user(s) requiring password migration.`);

  let migratedCount = 0;
  for (const user of users) {
    if (!user.password) continue;
    console.log(`Migrating user id=${user.id} (${user.email || user.name || 'unnamed'})...`);
    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        password: null, // Clear plaintext password
      },
    });
    migratedCount++;
    console.log(`Successfully migrated user id=${user.id}`);
  }

  console.log(`=== Migration completed successfully. Total users migrated: ${migratedCount} ===`);
}

main()
  .catch((err) => {
    console.error('Password migration error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
