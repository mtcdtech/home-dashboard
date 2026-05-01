import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // 🛡️ Robust Server-Side Authorization signal
  if (!session?.user || !(session.user as any).isAdmin) {
    console.log("Admin layout: Unauthorized access attempt by", session?.user?.email);
    redirect("/login");
  }

  console.log("Admin layout: Authorized access by", session.user.email);
  const userEmail = session.user.email;
  const user = userEmail ? await prisma.user.findUnique({
    where: { email: userEmail },
    select: { avatarColor: true, dashboardGroup: true }
  }) : null;

  return <AdminLayoutClient session={session} avatarColor={user?.avatarColor} dashboardGroup={user?.dashboardGroup}>{children}</AdminLayoutClient>;
}
