import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

function mimeToExt(mime) {
  const m = (mime || '').toLowerCase().trim();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/svg+xml' || m === 'image/svg') return 'svg';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/x-icon' || m === 'image/vnd.microsoft.icon' || m === 'image/ico') return 'ico';
  const parts = m.split('/');
  return parts[1] || 'png';
}

function parseDataUri(dataUri) {
  const match = dataUri.match(/^data:([^;,]+)(?:;charset=[^;,]+)?(?:;(base64))?,([\s\S]*)$/i);
  if (!match) {
    throw new Error('Invalid data URI format');
  }

  const mime = match[1];
  const isBase64 = match[2] === 'base64';
  const rawData = match[3];

  let buffer;
  if (isBase64) {
    buffer = Buffer.from(rawData, 'base64');
  } else {
    buffer = Buffer.from(decodeURIComponent(rawData), 'utf-8');
  }

  const ext = mimeToExt(mime);
  return { mime, ext, buffer };
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log('=================================================');
  console.log('BASE64 ICON MIGRATION TO DISK');
  console.log(`Mode: ${isApply ? 'APPLY (mutating DB & writing files)' : 'DRY RUN (no mutations)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('=================================================\n');

  const baseDir = process.cwd();
  const iconsDir = path.join(baseDir, 'public', 'uploads', 'icons');
  if (isApply) {
    await fs.promises.mkdir(iconsDir, { recursive: true });
  }

  // Find all Bookmark rows where icon starts with data:image
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      icon: {
        startsWith: 'data:image',
      },
    },
    select: {
      id: true,
      title: true,
      icon: true,
    },
  });

  const totalRows = bookmarks.length;
  console.log(`Found ${totalRows} Bookmark rows with base64 icons.\n`);

  if (totalRows === 0) {
    console.log('No base64 icons to migrate.');
    return;
  }

  const contentMap = new Map(); // sha16 -> { buffer, ext, path }
  let totalBytesSaved = 0;
  let writtenCount = 0;
  let reusedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < totalRows; i++) {
    const row = bookmarks[i];
    try {
      const { ext, buffer } = parseDataUri(row.icon);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const sha16 = sha256.substring(0, 16);
      const fileName = `${sha16}.${ext}`;
      const filePath = path.join(iconsDir, fileName);
      const relativeUrl = `/api/uploads/icons/${fileName}`;

      const oldLen = row.icon.length;
      totalBytesSaved += (oldLen - relativeUrl.length);

      let action = 'written';

      if (!contentMap.has(sha16)) {
        contentMap.set(sha16, { fileName, buffer, ext });
      }

      if (isApply) {
        let fileExists = false;
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.size === buffer.length) {
            fileExists = true;
          }
        }

        if (fileExists) {
          action = 'reused';
          reusedCount++;
        } else {
          await fs.promises.writeFile(filePath, buffer);
          action = 'written';
          writtenCount++;
        }

        await prisma.bookmark.update({
          where: { id: row.id },
          data: { icon: relativeUrl },
        });

        console.log(`[APPLY] (${i + 1}/${totalRows}) ${row.id} "${row.title}" oldLen=${oldLen} -> ${relativeUrl} [${action}]`);
      } else {
        // Dry run per-row or batch info
        if ((i + 1) % 10 === 0 || i === totalRows - 1) {
          console.log(`[DRY-RUN Progress] Checked ${i + 1}/${totalRows} rows...`);
        }
      }
    } catch (err) {
      console.error(`\n[ERROR] Failed processing row ${row.id} ("${row.title}"):`, err);
      process.exit(1);
    }
  }

  const uniqueCount = contentMap.size;
  const totalMbSaved = (totalBytesSaved / (1024 * 1024)).toFixed(2);

  console.log('\n=================================================');
  console.log('Migration Summary:');
  console.log(`Total base64 rows found: ${totalRows}`);
  console.log(`Unique icons by content: ${uniqueCount}`);
  console.log(`Total string bytes saved from DB: ${totalBytesSaved.toLocaleString()} bytes (~${totalMbSaved} MB)`);
  if (isApply) {
    console.log(`Files written to disk: ${writtenCount}`);
    console.log(`Files reused (already on disk): ${reusedCount}`);
  }
  console.log('=================================================');
}

main()
  .catch(err => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
