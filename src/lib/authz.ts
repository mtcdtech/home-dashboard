import { auth } from "@/auth";
import { resolveTabAccess, buildUserContext } from "./permissions";
import { prisma } from "./prisma";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized: Session required");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireSession();
  if (!(user as any).isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

export async function requireTabRole(tabId: string, action: 'edit' | 'owner') {
  const user = await requireSession();
  if ((user as any).isAdmin) return user;

  const tabObj = await prisma.tab.findUnique({
    where: { id: tabId },
    include: {
      owners: true,
      editors: true,
      departmentAccess: true,
      pushRules: true,
      allowedUsers: true,
    }
  });

  if (!tabObj) throw new Error("Tab not found");
  
  const targetUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    include: { allowedSections: true }
  });
  if (!targetUser) throw new Error("User not found");

  const context = buildUserContext({
    userId: targetUser.id,
    dashboardGroup: targetUser.dashboardGroup || targetUser.department,
    isAdminView: targetUser.isAdmin
  });
  const access = resolveTabAccess(tabObj, context);
  
  if (action === 'owner' && access.role !== 'owner') {
    throw new Error("Forbidden: Tab owner access required");
  }
  
  if (action === 'edit' && access.role !== 'owner' && access.role !== 'editor') {
    throw new Error("Forbidden: Tab edit access required");
  }

  return user;
}

export async function requireSectionRole(sectionId: string, action: 'edit' | 'owner') {
  const user = await requireSession();
  if ((user as any).isAdmin) return user;

  const sectionObj = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      owners: true,
      editors: true,
      departmentAccess: true,
      tabSections: { select: { tabId: true } }
    }
  });

  if (!sectionObj) throw new Error("Section not found");

  const isOwner = sectionObj.owners.some(u => u.id === user.id);
  const isEditor = sectionObj.editors.some(u => u.id === user.id);
  
  if (action === 'owner' && isOwner) return user;
  if (action === 'edit' && (isOwner || isEditor)) return user;

  // Check if they have tab-level access to ANY tab containing this section
  let hasTabAccess = false;
  for (const ts of sectionObj.tabSections) {
    try {
      await requireTabRole(ts.tabId, action);
      hasTabAccess = true;
      break;
    } catch (e) {
      // Ignore
    }
  }

  if (hasTabAccess) return user;

  throw new Error(`Forbidden: Section ${action} access required`);
}
