import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

// GET: List all department access entries for debugging
// DELETE: Remove "Entire Organization" access from specified tab IDs
export async function GET() {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const entries = await (prisma as any).tabDepartmentAccess.findMany({
    include: { tab: { select: { id: true, title: true } } }
  });
  
  return NextResponse.json(entries);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { tabId, department } = await req.json();
  if (!tabId || !department) return NextResponse.json({ error: "tabId and department required" }, { status: 400 });
  
  await (prisma as any).tabDepartmentAccess.deleteMany({
    where: { tabId, department }
  });
  
  return NextResponse.json({ ok: true });
}
