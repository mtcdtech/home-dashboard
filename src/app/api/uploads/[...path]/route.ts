import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  
  // Prevent path traversal
  if (pathSegments.some(segment => segment === '..' || segment === '.' || segment.includes('/'))) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const path = pathSegments.join("/");
  const baseUploadsDir = join(process.cwd(), "public", "uploads");
  const filePath = join(baseUploadsDir, path);

  // Double check that the resolved path is inside the uploads directory
  if (!filePath.startsWith(baseUploadsDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!existsSync(filePath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    const extension = path.split(".").pop()?.toLowerCase();
    
    let contentType = "image/png";
    if (extension === "jpg" || extension === "jpeg") contentType = "image/jpeg";
    if (extension === "svg") contentType = "image/svg+xml";
    if (extension === "gif") contentType = "image/gif";
    if (extension === "webp") contentType = "image/webp";
    if (extension === "ico") contentType = "image/x-icon";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return new NextResponse("Error reading file", { status: 500 });
  }
}
