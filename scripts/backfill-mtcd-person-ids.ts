import { runIamBackfill } from "../src/lib/iam-backfill";
import { prisma } from "../src/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");
  await runIamBackfill({ apply });
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
