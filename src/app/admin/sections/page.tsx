import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SectionsClient from "./SectionsClient";

export const dynamic = "force-dynamic";

export default async function SectionsAdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/");

  const [sections, tabs, users, themes] = await Promise.all([
    prisma.section.findMany({
      where: { isLibraryItem: true },
      orderBy: { title: "asc" },
      include: { 
        tabSections: true,
        bookmarks: { select: { id: true } },
        allowedUsers: { select: { id: true, name: true, email: true } },
        editors: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true } },
        blockedUsers: { select: { id: true, name: true, email: true } },
        departmentAccess: true
      }
    }),
    prisma.tab.findMany({
      where: { isLibraryItem: true },
      orderBy: { order: "asc" },
      select: { id: true, title: true, icon: true, pushRules: true, tabSections: { select: { sectionId: true } } }
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, department: true, dashboardGroup: true, avatarColor: true, isAdmin: true } }),
    prisma.theme.findMany()
  ]);

  const departments = Array.from(new Set(users.map(u => u.dashboardGroup || "General")));

  return (
    <div className="fade-in">
       <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Section Management</h2>
          <p style={{ opacity: 0.6 }}>Manage and assign service clusters across your organizational workspaces.</p>
       </div>
       
       <SectionsClient 
          initialSections={JSON.parse(JSON.stringify(sections))}
          tabs={JSON.parse(JSON.stringify(tabs))}
          users={JSON.parse(JSON.stringify(users))}
          departments={departments}
          themes={JSON.parse(JSON.stringify(themes))}
       />
    </div>
  );
}
