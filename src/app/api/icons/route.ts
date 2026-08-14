import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireSession } from '@/lib/authz';

export const revalidate = 86400; // Cache for 24 hours

export async function GET() {
  try {
    await requireSession();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const localIcons: string[] = [];
  
  // 1. Read local uploaded icons
  try {
     const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
     if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
           if (file.match(/\.(png|jpe?g|svg|webp|gif)$/i)) {
              localIcons.push(`/uploads/${file}`);
           }
        }
     }
  } catch (error) {
     console.error("Failed to read local uploads map:", error);
  }

  // 2. Fetch Github tree
  let externalIcons: string[] = [];
  try {
     const res = await fetch("https://api.github.com/repos/walkxcode/dashboard-icons/git/trees/main?recursive=1", {
         headers: { 'User-Agent': 'dashy-clone-nextjs' },
         next: { revalidate: 86400 }
     });
     if (res.ok) {
         const data = await res.json();
         if (data.tree) {
             const pngFiles = data.tree
                .filter((node: any) => node.path.startsWith('png/') && node.path.endsWith('.png'))
                .map((node: any) => {
                    // strip "png/" and ".png" to just return the icon name
                    return node.path.replace('png/', '').replace('.png', '');
                });
             externalIcons = pngFiles;
         }
     }
  } catch (error) {
     console.error("Failed to fetch GitHub icons list:", error);
  }
  
  // Combine internal uploads first, then external
  return NextResponse.json([...localIcons, ...externalIcons]);
}
