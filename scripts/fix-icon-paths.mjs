import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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

async function dumpDatabaseBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'public', 'uploads', 'backups');
  await fs.promises.mkdir(backupDir, { recursive: true });

  const sqlBackupPath = path.join(backupDir, `pre-fix-icon-paths-${timestamp}.sql`);
  const jsonBackupPath = path.join(backupDir, `pre-fix-icon-paths-${timestamp}.json`);

  const dbUrl = process.env.DATABASE_URL;
  let pgDumpSuccess = false;

  if (dbUrl) {
    try {
      execSync(`pg_dump -t '"Bookmark"' -t '"Section"' -t '"Tab"' -t '"Theme"' "${dbUrl}" > "${sqlBackupPath}"`, {
        stdio: 'ignore',
        timeout: 30000,
      });
      if (fs.existsSync(sqlBackupPath) && fs.statSync(sqlBackupPath).size > 0) {
        pgDumpSuccess = true;
        console.log(`[BACKUP] Successfully created pg_dump SQL backup: /app/public/uploads/backups/${path.basename(sqlBackupPath)}`);
      }
    } catch (e) {
      pgDumpSuccess = false;
    }
  }

  if (!pgDumpSuccess) {
    try {
      const bookmarks = await prisma.bookmark.findMany();
      const sections = await prisma.section.findMany();
      const tabs = await prisma.tab.findMany();
      const themes = await prisma.theme.findMany();

      const dumpData = { timestamp, bookmarks, sections, tabs, themes };
      await fs.promises.writeFile(jsonBackupPath, JSON.stringify(dumpData, null, 2), 'utf-8');
      console.log(`[BACKUP] pg_dump not reachable. Created Prisma JSON backup: /app/public/uploads/backups/${path.basename(jsonBackupPath)}`);
    } catch (err) {
      console.error('[BACKUP ERROR] Failed to create JSON backup:', err);
      throw err;
    }
  }
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log('=================================================');
  console.log('FIX ICON PATHS MIGRATION (/uploads/icons/ -> /api/uploads/icons/)');
  console.log(`Mode: ${isApply ? 'APPLY (mutating DB)' : 'DRY RUN (no DB mutations)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('=================================================\n');

  if (isApply) {
    console.log('[BACKUP] Creating pre-fix backup of Bookmark, Section, Tab, Theme tables...');
    await dumpDatabaseBackup();
  }

  const bookmarks = await prisma.bookmark.findMany({ select: { id: true, title: true, icon: true } });
  const sections = await prisma.section.findMany({ select: { id: true, title: true, icon: true } });
  const tabs = await prisma.tab.findMany({ select: { id: true, title: true, icon: true } });
  const themes = await prisma.theme.findMany({ select: { id: true, name: true, logoIcon: true } });

  const allRows = [
    ...bookmarks.map(b => ({ table: 'Bookmark', id: b.id, title: b.title, icon: b.icon, field: 'icon' })),
    ...sections.map(s => ({ table: 'Section', id: s.id, title: s.title, icon: s.icon, field: 'icon' })),
    ...tabs.map(t => ({ table: 'Tab', id: t.id, title: t.title, icon: t.icon, field: 'icon' })),
    ...themes.map(th => ({ table: 'Theme', id: th.id, title: th.name, icon: th.logoIcon, field: 'logoIcon' })),
  ];

  let totalMatching = 0;
  let rewrittenCount = 0;
  let skippedCount = 0;

  for (const row of allRows) {
    if (!row.icon) {
      skippedCount++;
      continue;
    }

    if (!row.icon.startsWith('/uploads/icons/')) {
      skippedCount++;
      continue;
    }

    totalMatching++;
    const oldPath = row.icon;
    const newPath = oldPath.replace('/uploads/icons/', '/api/uploads/icons/');

    if (isApply) {
      if (row.table === 'Bookmark') await prisma.bookmark.update({ where: { id: row.id }, data: { icon: newPath } });
      if (row.table === 'Section') await prisma.section.update({ where: { id: row.id }, data: { icon: newPath } });
      if (row.table === 'Tab') await prisma.tab.update({ where: { id: row.id }, data: { icon: newPath } });
      if (row.table === 'Theme') await prisma.theme.update({ where: { id: row.id }, data: { logoIcon: newPath } });
      rewrittenCount++;
      console.log(`OK ${row.table}.${row.id} "${row.title}" ${oldPath} -> ${newPath}`);
    } else {
      rewrittenCount++;
      console.log(`[DRY-RUN] WOULD UPDATE ${row.table}.${row.id} "${row.title}" ${oldPath} -> ${newPath}`);
    }
  }

  console.log('\n=================================================');
  console.log('Summary:');
  console.log(`Total matching rows found: ${totalMatching} | Rewritten: ${rewrittenCount} | Skipped: ${skippedCount}`);
  console.log('=================================================');
}

main()
  .catch(err => {
    console.error('Fix icon paths migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
