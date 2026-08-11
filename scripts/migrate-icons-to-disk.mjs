import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

function isExternalUrl(value) {
  if (!value) return false;
  if (!/^https?:\/\//i.test(value)) return false;
  return !value.includes('/uploads/');
}

function sniffImageType(buffer, contentType) {
  if (!buffer || buffer.length === 0) return null;

  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 && buffer[1] === 0x00 &&
    (buffer[2] === 0x01 || buffer[2] === 0x02) &&
    buffer[3] === 0x00
  ) {
    return { ext: 'ico', mime: 'image/x-icon' };
  }

  const textSample = buffer.slice(0, Math.min(buffer.length, 4096)).toString('utf-8').toLowerCase();
  if (textSample.includes('<svg') || (contentType && contentType.includes('image/svg+xml'))) {
    return { ext: 'svg', mime: 'image/svg+xml' };
  }

  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('image/png')) return { ext: 'png', mime: 'image/png' };
    if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return { ext: 'jpg', mime: 'image/jpeg' };
    if (ct.includes('image/svg+xml')) return { ext: 'svg', mime: 'image/svg+xml' };
    if (ct.includes('image/webp')) return { ext: 'webp', mime: 'image/webp' };
    if (ct.includes('image/gif')) return { ext: 'gif', mime: 'image/gif' };
    if (ct.includes('image/x-icon') || ct.includes('image/vnd.microsoft.icon') || ct.includes('image/ico')) {
      return { ext: 'ico', mime: 'image/x-icon' };
    }
  }

  return null;
}

function sanitizeSvg(buffer) {
  let str = buffer.toString('utf-8');
  str = str.replace(/<script[\s\S]*?<\/script>/gi, '');
  str = str.replace(/\b(on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return Buffer.from(str, 'utf-8');
}

async function downloadIconToDisk(sourceUrl) {
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return { error: 'Invalid URL provided' };
  }

  if (sourceUrl.startsWith('/uploads/')) {
    return { localPath: sourceUrl };
  }

  try {
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomeDashboardIconFetcher/1.0)',
      },
    });

    if (!res.ok) {
      return { error: `HTTP error ${res.status}: ${res.statusText}` };
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
      return { error: 'Image exceeds 2MB limit' };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 2 * 1024 * 1024) {
      return { error: 'Image exceeds 2MB limit' };
    }

    const contentType = res.headers.get('content-type');
    const typeInfo = sniffImageType(buffer, contentType);
    if (!typeInfo) {
      return { error: 'Invalid or unsupported image format' };
    }

    let finalBuffer = buffer;
    if (typeInfo.ext === 'svg') {
      finalBuffer = sanitizeSvg(buffer);
    }

    const hash = crypto.createHash('sha256').update(sourceUrl.trim()).digest('hex');
    const relativePath = `/uploads/icons/${hash}.${typeInfo.ext}`;
    const fullPath = path.join(process.cwd(), 'public', relativePath);

    if (fs.existsSync(fullPath)) {
      return { localPath: relativePath };
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, finalBuffer);

    return { localPath: relativePath };
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return { error: 'Fetch timed out (5s limit)' };
    }
    return { error: err.message || 'Download failed' };
  }
}

async function dumpDatabaseBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'public', 'uploads', 'backups');
  await fs.promises.mkdir(backupDir, { recursive: true });

  const sqlBackupPath = path.join(backupDir, `pre-icon-migration-${timestamp}.sql`);
  const jsonBackupPath = path.join(backupDir, `pre-icon-migration-${timestamp}.json`);

  const dbUrl = process.env.DATABASE_URL;
  let pgDumpSuccess = false;

  if (dbUrl) {
    try {
      execSync(`pg_dump -t '"Bookmark"' -t '"Section"' -t '"Tab"' "${dbUrl}" > "${sqlBackupPath}"`, {
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

      const dumpData = { timestamp, bookmarks, sections, tabs };
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
  console.log('ICON MIGRATION TO DISK');
  console.log(`Mode: ${isApply ? 'APPLY (mutating DB)' : 'DRY RUN (no DB mutations)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('=================================================\n');

  if (isApply) {
    console.log('[BACKUP] Creating pre-migration backup of Bookmark, Section, Tab tables...');
    await dumpDatabaseBackup();
  }

  const bookmarks = await prisma.bookmark.findMany({ select: { id: true, title: true, icon: true } });
  const sections = await prisma.section.findMany({ select: { id: true, title: true, icon: true } });
  const tabs = await prisma.tab.findMany({ select: { id: true, title: true, icon: true } });

  const allRows = [
    ...bookmarks.map(b => ({ table: 'Bookmark', id: b.id, title: b.title, icon: b.icon })),
    ...sections.map(s => ({ table: 'Section', id: s.id, title: s.title, icon: s.icon })),
    ...tabs.map(t => ({ table: 'Tab', id: t.id, title: t.title, icon: t.icon })),
  ];

  let totalProcessed = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const urlDownloadMap = new Map();

  for (const row of allRows) {
    if (!row.icon) {
      skippedCount++;
      continue;
    }

    if (!isExternalUrl(row.icon)) {
      skippedCount++;
      continue;
    }

    totalProcessed++;
    const url = row.icon.trim();

    if (!urlDownloadMap.has(url)) {
      const result = await downloadIconToDisk(url);
      urlDownloadMap.set(url, result);
    }

    const downloadRes = urlDownloadMap.get(url);

    if (downloadRes.localPath) {
      downloadedCount++;
      if (isApply) {
        if (row.table === 'Bookmark') await prisma.bookmark.update({ where: { id: row.id }, data: { icon: downloadRes.localPath } });
        if (row.table === 'Section') await prisma.section.update({ where: { id: row.id }, data: { icon: downloadRes.localPath } });
        if (row.table === 'Tab') await prisma.tab.update({ where: { id: row.id }, data: { icon: downloadRes.localPath } });
        console.log(`OK ${row.table}.${row.id} "${row.title}" ${url} -> ${downloadRes.localPath}`);
      } else {
        console.log(`[DRY-RUN] WOULD UPDATE ${row.table}.${row.id} "${row.title}" ${url} -> ${downloadRes.localPath}`);
      }
    } else {
      failedCount++;
      const errReason = downloadRes.error || 'Unknown error';
      if (isApply) {
        if (row.table === 'Bookmark') await prisma.bookmark.update({ where: { id: row.id }, data: { icon: null } });
        if (row.table === 'Section') await prisma.section.update({ where: { id: row.id }, data: { icon: null } });
        if (row.table === 'Tab') await prisma.tab.update({ where: { id: row.id }, data: { icon: null } });
        console.log(`FAIL ${row.table}.${row.id} "${row.title}" ${url} -> NULL (Error: ${errReason})`);
      } else {
        console.log(`[DRY-RUN] WOULD NULL ${row.table}.${row.id} "${row.title}" ${url} (Error: ${errReason})`);
      }
    }
  }

  console.log('\n=================================================');
  console.log('Summary:');
  console.log(`Total processed: ${totalProcessed} | Downloaded: ${downloadedCount} | Skipped: ${skippedCount} | Failed: ${failedCount}`);
  console.log('=================================================');
}

main()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
