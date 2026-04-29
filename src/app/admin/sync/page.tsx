import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SyncClient from "./SyncClient";

export const dynamic = 'force-dynamic';

export default async function SyncPage() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.isAdmin;
  if (!isAdmin) {
    redirect("/");
  }

  const [allTabs, allUsers, departments] = await Promise.all([
    prisma.tab.findMany({
      orderBy: { order: "asc" },
      include: {
        theme: true,
        allowedUsers: { select: { id: true, name: true, email: true, department: true, avatarColor: true, isAdmin: true } },
        editors: { select: { id: true, name: true, email: true, department: true, avatarColor: true, isAdmin: true } },
        owners: { select: { id: true, name: true, email: true, department: true, avatarColor: true, isAdmin: true } },
        departmentAccess: true,
        tabSections: {
          include: {
            section: true
          }
        }
      }
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, department: true, avatarColor: true, isAdmin: true },
      orderBy: { name: 'asc' }
    }),
    prisma.user.findMany({ select: { dashboardGroup: true } }).then(users => 
      Array.from(new Set(users.map(u => u.dashboardGroup || 'General').filter(Boolean)))
    )
  ]);

  return <SyncClient allTabs={JSON.parse(JSON.stringify(allTabs))} users={JSON.parse(JSON.stringify(allUsers))} departments={departments} />;
}
