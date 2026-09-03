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
  if (!(user as { isAdmin?: boolean }).isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

export async function requireTabRole(tabId: string, action: 'edit' | 'owner') {
  const user = await requireSession();
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

  const isAdmin = (user as { isAdmin?: boolean }).isAdmin;
  const isLocalAdmin = user.email === 'admin@local' || user.email === 'admin@local.host' || user.name === 'Local Admin';

  // Admin bypass: Admins have full access to all non-readOnlySync tabs (or all tabs if local admin)
  if (isAdmin) {
    if (!tabObj.isReadOnlySync || isLocalAdmin) {
      return user;
    }
  }

  // Check explicit ownership / editor assignment
  const isOwner = tabObj.owners.some(u => u.id === user.id);
  const isEditor = tabObj.editors.some(u => u.id === user.id);
  if (action === 'owner' && isOwner) return user;
  if (action === 'edit' && (isOwner || isEditor)) return user;

  // Unassigned tab without designated owners/editors on a non-read-only workspace
  if (tabObj.owners.length === 0 && tabObj.editors.length === 0 && !tabObj.isReadOnlySync) {
    return user;
  }

  // Check allowed users for edit access on non-read-only workspace
  const isAllowed = tabObj.allowedUsers.some(u => u.id === user.id);
  if (action === 'edit' && isAllowed && !tabObj.isReadOnlySync) {
    return user;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    include: { allowedSections: true }
  });
  if (!targetUser) throw new Error("User not found");

  const context = buildUserContext({
    userId: targetUser.id,
    dashboardGroup: targetUser.dashboardGroup || targetUser.department,
    isAdminView: targetUser.isAdmin,
    isLocalAdmin
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

export async function requireSectionRole(sectionId: string, action: 'edit' | 'owner', targetTabId?: string) {
  const user = await requireSession();
  const sectionObj = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      owners: true,
      editors: true,
      allowedUsers: true,
      departmentAccess: true,
      tabSections: { select: { tabId: true } }
    }
  });

  if (!sectionObj) throw new Error("Section not found");

  // Admin bypass following the access-matrix spec (resolveSectionAccess)
  if ((user as { isAdmin?: boolean }).isAdmin) {
    const isLocalAdmin = user.email === 'admin@local' || user.email === 'admin@local.host' || user.name === 'Local Admin';
    if (!sectionObj.isReadOnlySync || isLocalAdmin) {
      return user;
    }
  }

  const userEmail = user.email?.toLowerCase();
  const isOwner = sectionObj.owners.some(u => u.id === user.id || (userEmail && u.email?.toLowerCase() === userEmail));
  const isEditor = sectionObj.editors.some(u => u.id === user.id || (userEmail && u.email?.toLowerCase() === userEmail));
  const isAllowed = sectionObj.allowedUsers.some(u => u.id === user.id || (userEmail && u.email?.toLowerCase() === userEmail));
  
  if (action === 'owner' && isOwner) return user;
  if (action === 'edit' && (isOwner || isEditor || isAllowed)) return user;

  // Unattached or newly created section without designated owners/editors
  if (sectionObj.owners.length === 0 && sectionObj.editors.length === 0) {
    return user;
  }

  // If a target tab is specified, check access against that tab
  if (targetTabId) {
    try {
      await requireTabRole(targetTabId, action);
      return user;
    } catch {
      // Fall through
    }
  }

  // Check if they have tab-level access to ANY tab containing this section
  let hasTabAccess = false;
  for (const ts of sectionObj.tabSections) {
    try {
      await requireTabRole(ts.tabId, action);
      hasTabAccess = true;
      break;
    } catch {
      // Ignore
    }
  }

  if (hasTabAccess) return user;

  throw new Error(`Forbidden: Section ${action} access required`);
}
