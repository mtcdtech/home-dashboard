import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "@/components/Dashboard";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userEmail = session.user?.email;

  let dbUser = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, avatarColor: true, isAdmin: true, defaultTabId: true, layout: true }
  });

  const userId = dbUser?.id || (session.user as any)?.id;
  const userDepartment = session.user?.department;
  const isAdmin = dbUser?.isAdmin || (session.user as any)?.isAdmin || false;

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
        editors: { select: { id: true } },
        owners: { select: { id: true } },
        departmentAccess: true,
        tabSections: {
          orderBy: { order: "asc" },
          include: {
            section: {
              include: {
                bookmarks: { orderBy: { order: "asc" } },
                allowedUsers: { select: { id: true } },
                editors: { select: { id: true } },
                owners: { select: { id: true } },
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
      include: { theme: true }
    }),
    prisma.section.findMany({
      where: { 
        isLibraryItem: true,
        OR: [
          { organization: null },
          { organization: userDepartment || undefined }
        ]
      },
      include: { bookmarks: true }
    }),
    prisma.theme.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ select: { department: true } })
  ]);
  const allDepartments = Array.from(new Set(allUsers.map((u: any) => u.department || 'General')));

  // Filter sections based on visibility for non-admins and reshape to the expected prop shape
  const shapedTabs = tabs.map((tab: any) => {
    const visibleSections = tab.tabSections
      .filter((ts: any) => {
        const section = ts.section;
        if (isAdmin) return true;
        
        // Runtime Resolution for "Entire Organization" global role + Explicit Department Roles
        if (tab.departmentAccess?.some((da: any) => da.department === "Entire Organization" || (da.department || "").toLowerCase().trim() === (userDepartment || "").toLowerCase().trim())) return true;
        if (section.departmentAccess?.some((da: any) => da.department === "Entire Organization" || (da.department || "").toLowerCase().trim() === (userDepartment || "").toLowerCase().trim())) return true;

        if (section.isGlobal) return true;
        if (tab.allowedUsers?.some((u: any) => u.id === userId)) return true;
        if (tab.editors?.some((u: any) => u.id === userId)) return true;
        if (tab.owners?.some((u: any) => u.id === userId)) return true;
        if (section.allowedUsers?.some((u: any) => u.id === userId)) return true;
        if (section.editors?.some((u: any) => u.id === userId)) return true;
        if (section.organization && section.organization === userDepartment) return true;
        return false;
      })
      .map((ts: any) => ({
        ...ts.section,
        column: ts.column,
        height: ts.height,
        defaultCollapsed: ts.defaultCollapsed || false,
        tabId: tab.id, // helpful for actions
      }));

    return {
      ...tab,
      sections: visibleSections,
    };
  }).filter((tab: any) => {
    if (isAdmin) return true;
    if (tab.sections.length > 0) return true;
    // Show empty tabs if user has tab-level access via departmentAccess
    if (tab.departmentAccess?.some((da: any) => da.department === "Entire Organization" || (da.department || "").toLowerCase().trim() === (userDepartment || "").toLowerCase().trim())) return true;
    // Also show if user is directly on the tab
    if (tab.allowedUsers?.some((u: any) => u.id === userId)) return true;
    if (tab.editors?.some((u: any) => u.id === userId)) return true;
    if (tab.owners?.some((u: any) => u.id === userId)) return true;
    return false;
  });

  const userLayout = (dbUser as any)?.layout || {};
  
  // Apply personal overrides
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

  if (Array.isArray(userLayout.tabOrder)) {
     shapedTabs.sort((a: any, b: any) => {
         const idxA = userLayout.tabOrder.indexOf(a.id);
         const idxB = userLayout.tabOrder.indexOf(b.id);
         if (idxA !== -1 && idxB !== -1) return idxA - idxB;
         if (idxA !== -1) return -1;
         if (idxB !== -1) return 1;
         return a.order - b.order;
     });
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
      userName={session.user.name}
      avatarColor={avatarColor}
      canEditContent={isAdmin || (session.user as any).canEditContent || false}
      iconSize={(session.user as any).iconSize || (activeTheme as any)?.iconSize || 48}
      libraryTabs={JSON.parse(JSON.stringify(libraryTabs || []))}
      librarySections={JSON.parse(JSON.stringify(librarySections || []))}
      allThemes={JSON.parse(JSON.stringify(allThemes || []))}
      allDepartments={allDepartments}
      userDefaultTabId={(dbUser as any)?.defaultTabId || null}
      globalDefaultTabId={globalSettings?.defaultTabId || null}
    />
  );
}
