import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Also write to disk for legacy reasons/backup
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "").replace(/\.\.+/g, ".");
    const filename = `${Date.now()}-${cleanName}`;
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);
    
    // Return base64 so it stores directly in DB and works across Synology instances
    const mimeType = file.type || "image/png";
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    return NextResponse.json({ url: dataUrl });
  } catch (err: any) {
    console.error("API Upload Error:", err);
    return NextResponse.json({ error: err.message || "Manifestation failure" }, { status: 500 });
  }
}
