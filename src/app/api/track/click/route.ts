import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateResult = checkRateLimit(ip, 60, 60000, "track_click");
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests" },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
        },
      }
    );
  }

  try {
    const session = await auth();
    const { bookmarkId, bookmarkTitle, bookmarkUrl } = await req.json();
    if (!bookmarkId) return NextResponse.json({ ok: false });

    // Record click
    await (prisma as any).clickEvent.create({
      data: {
        bookmarkId,
        userId: session?.user?.id ?? null,
      }
    });

    // Record activity log
    await (prisma as any).activityLog.create({
      data: {
        userId: session?.user?.id ?? null,
        userName: session?.user?.name ?? null,
        type: "bookmark_click",
        detail: `${bookmarkTitle || "Bookmark"} → ${bookmarkUrl || ""}`,
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Track click error:", err);
    return NextResponse.json({ ok: false });
  }
}
