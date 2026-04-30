import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ThemeClient from "./ThemeClient";

export const dynamic = "force-dynamic";

export default async function ThemeAdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/");

  const [themes, globalSettings, users, allDepts] = await Promise.all([
    prisma.theme.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        owners: { select: { id: true, name: true, email: true } },
        editors: { select: { id: true, name: true, email: true } },
        allowedUsers: { select: { id: true, name: true, email: true } },
        blockedUsers: { select: { id: true, name: true, email: true } },
        departmentAccess: true,
        tabs: {
          select: {
            id: true,
            pushRules: true,
            owners: { select: { id: true } },
            editors: { select: { id: true } },
            allowedUsers: { select: { id: true } },
            blockedUsers: { select: { id: true } },
            departmentAccess: true
          }
        }
      }
    }),
    prisma.globalSettings.findUnique({ where: { id: "global" } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, department: true, dashboardGroup: true, avatarColor: true, isAdmin: true } })
  ]);

  const departments = Array.from(new Set(users.map(u => u.dashboardGroup || "General")));

  const defaultSettings = { 
    logoUrlLight: "", 
    logoUrlDark: "", 
    systemThemeColor: "#3b82f6" 
  };

  return (
    <div className="fade-in">
       <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Themes & Branding</h2>
          <p style={{ opacity: 0.6 }}>Craft premium identities with custom branding and granular access control for each theme.</p>
       </div>
       
       <ThemeClient 
          initialThemes={JSON.parse(JSON.stringify(themes))} 
          globalSettings={JSON.parse(JSON.stringify(globalSettings || defaultSettings))}
          users={JSON.parse(JSON.stringify(users))}
          departments={departments}
       />
    </div>
  );
}
