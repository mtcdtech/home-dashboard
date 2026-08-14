import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import path, { join } from 'path';
import { existsSync } from 'fs';

export async function GET(request: Request) {
   const { searchParams } = new URL(request.url);
   const id = searchParams.get('id');
   const token = searchParams.get('token');

   if (!id || !token) {
      return NextResponse.json({ error: 'Missing id or token' }, { status: 400 });
   }

   try {
      const tab = await prisma.tab.findUnique({
         where: { id },
         include: {
            theme: true,
            tabSections: {
               include: {
                  section: {
                     include: {
                        bookmarks: true,
                     }
                  }
               }
            }
         }
      });

      if (!tab) {
         return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }

      if (tab.syncToken !== token) {
         return NextResponse.json({ error: 'Invalid sync token' }, { status: 403 });
      }

      const makeAbsolute = (url: string | null | undefined) => url?.startsWith('/') ? `${new URL(request.url).origin}${url}` : url;

      const encodeMediaToBase64 = async (url: string | null | undefined) => {
         if (!url) return url;
         if (url.startsWith('data:image')) return url;

         if (url.startsWith('/uploads/') || url.startsWith('/api/uploads/') || url.includes('/uploads/') || url.includes('/api/uploads/')) {
            const uploadMatch = url.match(/(?:\/api\/uploads\/|\/uploads\/)([^\s?#]+)/);
            if (uploadMatch) {
               try {
                  const filename = uploadMatch[1];
                  const baseUploadsDir = join(process.cwd(), 'public', 'uploads');
                  const filePath = join(baseUploadsDir, filename);
                  const resolved = path.resolve(filePath);
                  if (!resolved.startsWith(path.resolve(baseUploadsDir) + path.sep)) {
                     return makeAbsolute(url);
                  }
                  if (existsSync(filePath)) {
                     const buffer = await readFile(filePath);
                     const ext = filename.split('.').pop()?.toLowerCase() || 'png';
                     let mimeType = 'image/png';
                     if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                     if (ext === 'svg') mimeType = 'image/svg+xml';
                     if (ext === 'gif') mimeType = 'image/gif';
                     if (ext === 'webp') mimeType = 'image/webp';
                     if (ext === 'ico') mimeType = 'image/x-icon';
                     return `data:${mimeType};base64,${buffer.toString('base64')}`;
                  }
               } catch (e) {
                  console.error("Base64 encode error:", e);
               }
            }
         }

         if (/^https?:\/\//i.test(url)) {
            try {
               const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
               if (res.ok) {
                  const arrayBuffer = await res.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  const contentType = res.headers.get('content-type') || 'image/png';
                  const mimeType = contentType.split(';')[0].trim();
                  return `data:${mimeType};base64,${buffer.toString('base64')}`;
               }
            } catch (e) {
               console.error("Base64 external fetch error:", e);
            }
         }

         return makeAbsolute(url);
      };

      // Format payload
      const payload = {
         version: '1.0',
         tab: {
            title: tab.title,
            icon: await encodeMediaToBase64(tab.icon),
            columns: tab.columns,
            description: tab.description,
            theme: tab.theme ? {
               name: tab.theme.name,
               dashboardTitle: tab.theme.dashboardTitle,
               logoIcon: await encodeMediaToBase64(tab.theme.logoIcon),
               primaryColor: tab.theme.primaryColor,
               backgroundColor: await encodeMediaToBase64(tab.theme.backgroundColor),
               darkMode: tab.theme.darkMode,
               glassEffect: tab.theme.glassEffect,
               backgroundBlur: tab.theme.backgroundBlur,
               backgroundTint: tab.theme.backgroundTint,
               sectionOpacity: tab.theme.sectionOpacity,
               glassOpacity: tab.theme.glassOpacity,
               iconSize: tab.theme.iconSize,
            } : null,
            sections: await Promise.all(tab.tabSections.map(async ts => ({
               title: ts.section.title,
               icon: await encodeMediaToBase64(ts.section.icon),
               description: ts.section.description,
               order: ts.order,
               column: ts.column,
               height: ts.height,
               defaultCollapsed: ts.defaultCollapsed,
               bookmarks: await Promise.all(ts.section.bookmarks.map(async b => ({
                  title: b.title,
                  url: b.url,
                  description: b.description,
                  icon: await encodeMediaToBase64(b.icon),
                  longDescription: b.longDescription,
                  openInNewTab: b.openInNewTab,
                  order: b.order,
               })))
            })))
         }
      };

      return NextResponse.json(payload);
   } catch (error) {
      console.error('Export error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
   }
}
