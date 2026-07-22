import { prisma } from "@/lib/prisma";
import UserBoard from "./UserBoard";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const [users, tabs, globalSettings] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        allowedTabs: { select: { id: true, title: true } },
        managedTabs: { select: { id: true, title: true } },
        allowedSections: { select: { id: true, title: true } },
        managedSections: { select: { id: true, title: true } },
      }
    }),
    prisma.tab.findMany({ orderBy: { order: "asc" }, select: { id: true, title: true } }),
    (prisma as any).globalSettings.findUnique({ where: { id: "global" } })
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>User Management</h2>
        <p style={{ opacity: 0.5, marginTop: '0.25rem', fontSize: '0.875rem' }}>
          Manage roles, departments, and permissions for all provisioned users.
        </p>
      </div>

      <UserBoard initialUsers={users as any[]} allTabs={tabs} initialDisableLocalAdmin={globalSettings?.disableLocalAdmin ?? false} />
    </div>
  );
}
