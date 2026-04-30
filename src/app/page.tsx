import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "@/components/Dashboard";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { buildUserContext, resolveTabAccess, resolveSectionAccess } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userEmail = session.user?.email;

  let dbUser = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, avatarColor: true, isAdmin: true, defaultTabId: true, layout: true, department: true, dashboardGroup: true }
  });

  const realUserId = dbUser?.id || (session.user as any)?.id;
  const realIsAdmin = dbUser?.isAdmin || (session.user as any)?.isAdmin || false;

  // Impersonation: allow admins to view as another user
  let impersonateUserId: string | null = null;
  if (realIsAdmin) {
    const cookieStore = await cookies();
    const imp = cookieStore.get("impersonate_user_id")?.value;
    if (imp && imp !== realUserId) {
      const target = await prisma.user.findUnique({ where: { id: imp }, select: { id: true, avatarColor: true, isAdmin: true, defaultTabId: true, layout: true, email: true, name: true } });
      if (target) {
        impersonateUserId = target.id;
        dbUser = target as any;
      }
    }
  }

  const userId = dbUser?.id || realUserId;
  const userDepartment = impersonateUserId
    ? (await prisma.user.findUnique({ where: { id: userId }, select: { department: true } }))?.department
    : dbUser?.department || session.user?.department;
  const rawUserDashboardGroup = impersonateUserId
    ? (await prisma.user.findUnique({ where: { id: userId }, select: { dashboardGroup: true } }))?.dashboardGroup
    : dbUser?.dashboardGroup || session.user?.dashboardGroup;
  const userDashboardGroup = rawUserDashboardGroup || "General";
  const isAdmin = realIsAdmin; // keep real admin access even when impersonating
  // When impersonating, use target user's access rules (not admin bypass)
  const isAdminView = realIsAdmin && !impersonateUserId;

  if (dbUser && !dbUser.avatarColor) {
     const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#82E0AA", "#F1948A"];
     const randomColor = colors[Math.floor(Math.random() * colors.length)];
     await prisma.user.update({
        where: { id: userId },
        data: { avatarColor: randomColor }
     });
     dbUser.avatarColor = randomColor;
  }
  const avatarColor = dbUser?.avatarColor || "#3b82f6";

  // Fetch all tabs with sections via the new M2M join, including their themes
  const [tabs, activeTheme, globalSettings, libraryTabs, librarySections, allThemes, allUsers] = await Promise.all([
    prisma.tab.findMany({
      orderBy: { order: "asc" },
      include: {
        theme: true,
        allowedUsers: { select: { id: true } },
        editors: { select: { id: true, name: true, email: true, avatarColor: true } },
        owners: { select: { id: true, name: true, email: true, avatarColor: true } },
        blockedUsers: { select: { id: true } },
        departmentAccess: true,
        pushRules: true,
        tabSections: {
          orderBy: { order: "asc" },
          include: {
            section: {
              include: {
                bookmarks: { orderBy: { order: "asc" } },
                allowedUsers: { select: { id: true } },
                editors: { select: { id: true, name: true, email: true, avatarColor: true } },
                owners: { select: { id: true, name: true, email: true, avatarColor: true } },
                blockedUsers: { select: { id: true } },
                departmentAccess: true,
              },
            },
          },
        },
      } as any,
    }),
    prisma.theme.findFirst({ where: { isActive: true } }),
    (prisma as any).globalSettings.findUnique({ where: { id: "global" } }),
    prisma.tab.findMany({
      where: { 
        isLibraryItem: true, 
        OR: [
          { organization: null },
          { organization: userDepartment || undefined }
        ]
      },
      include: {
        theme: true,
        allowedUsers: { select: { id: true } },
        editors: { select: { id: true, name: true, email: true, avatarColor: true } },
        owners: { select: { id: true, name: true, email: true, avatarColor: true } },
        blockedUsers: { select: { id: true } },
        departmentAccess: true,
      }
    }),
    prisma.section.findMany({
      where: { 
        isLibraryItem: true,
        OR: [
          { organization: null },
          { organization: userDepartment || undefined }
        ]
      },
      include: { 
        bookmarks: true,
        departmentAccess: true,
        allowedUsers: { select: { id: true } },
        editors: { select: { id: true } },
        owners: { select: { id: true } },
        blockedUsers: { select: { id: true } }
      }
    }),
    prisma.theme.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, dashboardGroup: true, department: true, isAdmin: true, avatarColor: true } })
  ]);
  const allDepartments = Array.from(new Set(allUsers.map((u: any) => u.dashboardGroup || 'General')));
  // Filter out "Local Admin" — admins who aren't the local system admin
  const adminUsers = allUsers.filter((u: any) => u.isAdmin && u.name !== 'Local Admin' && u.email !== 'admin@local');

  const userCtx = buildUserContext({ userId, dashboardGroup: userDashboardGroup, isAdminView });

  // Filter catalog tabs by user access when not in admin view
  const filteredLibraryTabs = isAdminView
    ? libraryTabs
    : libraryTabs.filter((lt: any) => resolveTabAccess(lt, userCtx).role !== "none");

  // Filter catalog sections by user access when not in admin view.
  // Catalog sections are filtered standalone (no tab context), so we evaluate
  // them as if the tab gate already passed.
  const filteredLibrarySections = isAdminView
    ? librarySections
    : librarySections.filter((ls: any) => {
        const fakeTabAccess = { role: "viewer", source: "global", pushed: false, locked: false, inherited: true } as const;
        return resolveSectionAccess(ls, {} as any, fakeTabAccess, userCtx).role !== "none";
      });

  const userLayout = (dbUser as any)?.layout || {};

  // Filter sections based on visibility for non-admins and reshape to the expected prop shape
  const shapedTabs = tabs
    .map((tab: any) => ({ tab, access: resolveTabAccess(tab, userCtx) }))
    .filter(({ tab, access }: any) => {
      if (access.role === "none") return false;
      if (isAdminView) return true;
      if (access.locked) return true;
      if (userLayout.hiddenTabs?.includes(tab.id)) return false;
      if (access.pushed) return true;
      if (access.role === "owner" || access.role === "editor") return true;
      if (userLayout.tabOrder?.includes(tab.id)) return true;
      return false;
    })
    .map(({ tab, access }: any) => {
      const visibleSections = tab.tabSections
        .filter((ts: any) => resolveSectionAccess(ts.section, tab, access, userCtx).role !== "none")
        .map((ts: any) => ({
          ...ts.section,
          column: ts.column,
          height: ts.height,
          defaultCollapsed: ts.defaultCollapsed || false,
          tabId: tab.id,
        }));

      return {
        ...tab,
        sections: visibleSections,
        isLocked: access.locked
      };
    });

  // Apply personal overrides for sections ONLY if not admin
  if (!isAdminView) {
     shapedTabs.forEach((tab: any) => {
       const tabOverrides = userLayout.tabSections?.[tab.id];
       if (tabOverrides) {
          tab.sections.forEach((section: any) => {
             const override = tabOverrides[section.id];
             if (override) {
                if (override.column !== undefined) section.column = override.column;
                if (override.order !== undefined) section.order = override.order;
                if (override.collapsed !== undefined) section.defaultCollapsed = override.collapsed;
             }
          });
       }
       // Re-sort sections within columns since we might have changed them
       tab.sections.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
     });
  } else {
     // Admins just see the global DB order for sections
     shapedTabs.forEach((tab: any) => {
        tab.sections.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
     });
  }

  // EVERY user gets their own personal tab order
  if (Array.isArray(userLayout.tabOrder)) {
     shapedTabs.sort((a: any, b: any) => {
         const idxA = userLayout.tabOrder.indexOf(a.id);
         const idxB = userLayout.tabOrder.indexOf(b.id);
         if (idxA !== -1 && idxB !== -1) return idxA - idxB;
         if (idxA !== -1) return -1;
         if (idxB !== -1) return 1;
         return a.order - b.order;
     });
  } else {
     shapedTabs.sort((a: any, b: any) => a.order - b.order);
  }

  return (
    <Dashboard 
      tabs={JSON.parse(JSON.stringify(shapedTabs))} 
      activeTheme={(activeTheme || {
        id: "default",
        name: "Default Blue",
        primaryColor: "#3b82f6",
        backgroundColor: null,
        darkMode: true,
        glassEffect: true,
        dashboardTitle: "Dashboard",
        logoIcon: "LayoutGrid"
      }) as any}
      globalSettings={JSON.parse(JSON.stringify(globalSettings || { logoUrlLight: "", logoUrlDark: "", logoUrlSquareLight: "", logoUrlSquareDark: "", systemThemeColor: "#3b82f6" }))}
      userDepartment={userDepartment} 
      isAdmin={isAdmin}
      currentUserId={userId}
      userName={impersonateUserId ? (dbUser as any)?.name || (dbUser as any)?.email : session.user.name}
      avatarColor={avatarColor}
      canEditContent={isAdmin || (session.user as any).canEditContent || false}
      iconSize={(session.user as any).iconSize || (activeTheme as any)?.iconSize || 48}
      libraryTabs={JSON.parse(JSON.stringify(filteredLibraryTabs || []))}
      librarySections={JSON.parse(JSON.stringify(filteredLibrarySections || []))}
      allThemes={JSON.parse(JSON.stringify(allThemes || []))}
      allDepartments={allDepartments}
      userDefaultTabId={(dbUser as any)?.defaultTabId || null}
      globalDefaultTabId={globalSettings?.defaultTabId || null}
      impersonating={impersonateUserId ? { userId: impersonateUserId, userName: (dbUser as any)?.name || (dbUser as any)?.email || "User" } : null}
      adminUsers={JSON.parse(JSON.stringify(adminUsers || []))}
      allUsers={JSON.parse(JSON.stringify(allUsers || []))}
    />
  );
}
