import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

// GET: Diagnose why tabs might be showing for all users
export async function GET() {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const tabs = await (prisma as any).tab.findMany({
    select: {
      id: true,
      title: true,
      isLibraryItem: true,
      pushToNewUsers: true,
      organization: true,
      isReadOnlySync: true,
      departmentAccess: true,
      pushRules: true,
      allowedUsers: { select: { id: true, name: true } },
      editors: { select: { id: true, name: true } },
      owners: { select: { id: true, name: true } },
      blockedUsers: { select: { id: true, name: true } },
    }
  });

  const issues = tabs.map((tab: any) => ({
    tab: tab.title,
    id: tab.id,
    problems: [
      ...(tab.departmentAccess?.filter((da: any) => da.department === "Entire Organization").length > 0
        ? [`HAS "Entire Organization" dept access`] : []),
      ...(tab.pushToNewUsers ? ["Legacy pushToNewUsers=true"] : []),
      ...(tab.organization === null && !tab.isReadOnlySync ? ["No department filter (visible to all orgs)"] : []),
    ],
    departmentAccess: tab.departmentAccess,
    pushRules: tab.pushRules,
    allowedUsers: tab.allowedUsers,
    editors: tab.editors,
    owners: tab.owners,
  })).filter((t: any) => t.problems.length > 0 || t.departmentAccess.length > 0 || t.pushRules.length > 0);

  return NextResponse.json({ issues, allTabs: tabs.map((t: any) => ({ id: t.id, title: t.title, departmentAccess: t.departmentAccess, pushRules: t.pushRules, allowedUsers: t.allowedUsers, editors: t.editors, owners: t.owners })) });
}

// POST: Clean up stale entries
export async function POST(req: Request) {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const body = await req.json();
  const { action, tabId, userId, tabIds, department } = body;
  
  if (action === "purge_entire_org") {
    const result = await (prisma as any).tabDepartmentAccess.deleteMany({
      where: { department: "Entire Organization" }
    });
    return NextResponse.json({ deleted: result.count });
  }
  
  if (action === "purge_push_to_new") {
    const result = await (prisma as any).tab.updateMany({
      where: { pushToNewUsers: true },
      data: { pushToNewUsers: false }
    });
    return NextResponse.json({ updated: result.count });
  }
  
  // Bulk cleanup: remove a user from push rules AND allowedUsers for specific tabs
  if (action === "cleanup_user_from_tabs" && userId && tabIds) {
    let pushDeleted = 0;
    let accessRemoved = 0;
    for (const tid of tabIds) {
      const r = await (prisma as any).tabPushRule.deleteMany({
        where: { tabId: tid, targetType: "user", targetId: userId }
      });
      pushDeleted += r.count;
      try {
        await prisma.tab.update({
          where: { id: tid },
          data: { allowedUsers: { disconnect: { id: userId } } }
        });
        accessRemoved++;
      } catch {}
    }
    return NextResponse.json({ pushDeleted, accessRemoved });
  }
  
  // Remove department access
  if (action === "remove_dept_access" && tabId && department) {
    await (prisma as any).tabDepartmentAccess.deleteMany({
      where: { tabId, department }
    });
    return NextResponse.json({ ok: true });
  }
  
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
