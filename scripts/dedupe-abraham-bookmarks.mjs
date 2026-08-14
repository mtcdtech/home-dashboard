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
  const isApply = process.argv.includes('--apply');
  console.log('=================================================');
  console.log('ABRAHAM BOOKMARKS DEDUPLICATION');
  console.log(`Mode: ${isApply ? 'APPLY (deleting duplicate rows)' : 'DRY RUN (no deletions)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('=================================================\n');

  const bookmarks = await prisma.bookmark.findMany({
    select: {
      id: true,
      title: true,
      url: true,
      sectionId: true,
      createdAt: true,
      icon: true,
    },
  });

  console.log(`Total bookmarks in DB: ${bookmarks.length}`);

  // Group by (title, url, sectionId)
  const groups = new Map();

  for (const b of bookmarks) {
    const key = `${b.sectionId}:::${(b.title || '').trim()}:::${(b.url || '').trim()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(b);
  }

  const duplicateGroups = [];
  let totalToDelete = 0;
  const allIdsToDelete = [];

  for (const [key, rows] of groups.entries()) {
    if (rows.length > 1) {
      // Sort newest createdAt first; tiebreak by id
      rows.sort((a, b) => {
        const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id);
      });

      const keep = rows[0];
      const remove = rows.slice(1);

      duplicateGroups.push({
        key,
        title: keep.title,
        url: keep.url,
        sectionId: keep.sectionId,
        keep,
        remove,
      });

      totalToDelete += remove.length;
      for (const r of remove) {
        allIdsToDelete.push(r.id);
      }
    }
  }

  console.log(`Duplicate groups found: ${duplicateGroups.length}`);
  console.log(`Total duplicate rows to delete: ${totalToDelete}\n`);

  if (duplicateGroups.length === 0) {
    console.log('No duplicate bookmarks found.');
    return;
  }

  for (let i = 0; i < duplicateGroups.length; i++) {
    const g = duplicateGroups[i];
    console.log(`[Group ${i + 1}/${duplicateGroups.length}] "${g.title}" (section: ${g.sectionId})`);
    console.log(`  URL: ${g.url}`);
    console.log(`  KEEP: id=${g.keep.id} createdAt=${g.keep.createdAt.toISOString()}`);
    for (const r of g.remove) {
      console.log(`  DELETE: id=${r.id} createdAt=${r.createdAt.toISOString()}`);
    }

    if (isApply) {
      const deleteIds = g.remove.map(r => r.id);
      await prisma.bookmark.deleteMany({
        where: {
          id: { in: deleteIds },
        },
      });
      console.log(`  -> Deleted ${deleteIds.length} duplicate row(s) for "${g.title}"`);
    }
  }

  console.log('\n=================================================');
  console.log('Deduplication Summary:');
  console.log(`Total bookmarks evaluated: ${bookmarks.length}`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);
  console.log(`Rows ${isApply ? 'deleted' : 'to delete'}: ${totalToDelete}`);
  console.log(`Bookmarks remaining: ${bookmarks.length - (isApply ? totalToDelete : 0)}`);
  console.log('=================================================');
}

main()
  .catch(err => {
    console.error('Fatal deduplication error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
