import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isAbraham = process.env.NEXTAUTH_URL?.includes("abraham16.com") || process.env.AUTH_URL?.includes("abraham16.com");
  const filename = isAbraham ? 'abraham-favicon-32.png' : 'church-favicon-32.png';
  const filePath = path.join(process.cwd(), 'public', filename);
  
  try {
    const imageBuffer = fs.readFileSync(filePath);
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, must-revalidate',
      },
    });
  } catch (error) {
    console.error("Failed to read favicon:", error);
    return new NextResponse("Not Found", { status: 404 });
  }
}
