import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// POST /api/admin/impersonate — sets impersonate cookie for admin
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins can impersonate
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const cookieStore = await cookies();
  cookieStore.set("impersonate_user_id", userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return NextResponse.json({ ok: true, target });
}

// DELETE /api/admin/impersonate — clears the impersonate cookie
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("impersonate_user_id");
  return NextResponse.json({ ok: true });
}
