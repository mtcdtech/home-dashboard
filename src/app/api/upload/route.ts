import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/auth";
import { ALLOWED_IMAGE_EXTENSIONS, MAX_UPLOAD_BYTES, isMagicImage, sanitizeImageFilename } from "@/lib/image-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const { filename, ext } = sanitizeImageFilename(file.name);
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: png, jpg, jpeg, webp, gif, ico" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 413 });
    }

    if (!isMagicImage(buffer)) {
      return NextResponse.json({ error: "Invalid image content or signature" }, { status: 400 });
    }
    
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);
    
    return NextResponse.json({ url: `/api/uploads/${filename}` });
  } catch (err: any) {
    console.error("API Upload Error:", err);
    return NextResponse.json({ error: err.message || "Upload failure" }, { status: 500 });
  }
}
