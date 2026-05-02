// Single-source permissions resolver implementing the access-matrix spec.
//
// resolveTabAccess and resolveSectionAccess take a UserContext plus a tab/section
// (with relations preloaded) and return a normalized AccessDecision describing:
//   - role:     "owner" | "editor" | "viewer" | "none"
//   - source:   why the access was granted/denied
//   - pushed:   true if any push rule applies to this user
//   - locked:   true if the applicable push rule is locked (cannot be removed)
//   - inherited: true if the role came from a department/global rule rather than
//                an explicit user grant or push.
//
// Spec highlights:
//   - Admin view bypasses checks (admin == owner everywhere).
//   - isGlobal grants viewer to everyone (overrides blocks per matrix line 3).
//   - blockedUsers explicit deny overrides allow (line 4 in code), except isGlobal.
//   - Non-catalog tabs/sections are visible only to their owners.
//   - Push rules grant viewer minimum; locked pushes cannot be removed by user.
//   - Imported workspaces (isReadOnlySync) are never catalog items by definition,
//     so callers should never set isLibraryItem=true on imported records.

export type AccessRole = "owner" | "editor" | "viewer" | "none";

export type AccessSource =
  | "admin"
  | "global"
  | "blocked"
  | "owner"
  | "editor"
  | "allowed"
  | "push-global"
  | "push-department"
  | "push-user"
  | "department"
  | "department-deny"
  | "tab-inherit"
  | "non-catalog-owner"
  | "none";

export interface AccessDecision {
  role: AccessRole;
  source: AccessSource;
  pushed: boolean;
  locked: boolean;
  inherited: boolean;
}

export interface UserContext {
  userId: string;
  department: string;        // dashboardGroup, normalized non-empty (defaults "General")
  isAdminView: boolean;      // admin viewing as themselves (not impersonating)
  isLocalAdmin: boolean;     // true if the user is the Local Admin (admin@local)
}

interface UserRef { id: string }
interface DeptAccess { department: string | null; role: string }
interface PushRule { targetType: string; targetId: string | null; locked?: boolean }

interface TabLike {
  id: string;
  isGlobal?: boolean;
  isLibraryItem?: boolean;
  isPublic?: boolean;
  isReadOnlySync?: boolean;
  blockedUsers?: UserRef[];
  allowedUsers?: UserRef[];
  editors?: UserRef[];
  owners?: UserRef[];
  departmentAccess?: DeptAccess[];
  pushRules?: PushRule[];
}

interface SectionLike {
  id: string;
  isGlobal?: boolean;
  isLibraryItem?: boolean;
  isReadOnlySync?: boolean;
  organization?: string | null;
  blockedUsers?: UserRef[];
  allowedUsers?: UserRef[];
  editors?: UserRef[];
  owners?: UserRef[];
  departmentAccess?: DeptAccess[];
}

const NONE: AccessDecision = { role: "none", source: "none", pushed: false, locked: false, inherited: false };

function normDept(d?: string | null): string {
  return (d || "").toLowerCase().trim();
}

function hasUser(list: UserRef[] | undefined, userId: string): boolean {
  return !!list?.some(u => u.id === userId);
}

export function buildUserContext(args: {
  userId: string;
  dashboardGroup?: string | null;
  isAdminView: boolean;
  isLocalAdmin?: boolean;
}): UserContext {
  return {
    userId: args.userId,
    department: args.dashboardGroup || "General",
    isAdminView: args.isAdminView,
    isLocalAdmin: args.isLocalAdmin || false,
  };
}

function findPushRule(tab: TabLike, ctx: UserContext): PushRule | undefined {
  const rules = tab.pushRules || [];
  // Order matters only for source labeling; any matching rule grants viewer min.
  const userRule = rules.find(r => r.targetType === "user" && r.targetId === ctx.userId);
  if (userRule) return userRule;
  const deptRule = rules.find(r =>
    r.targetType === "department" && normDept(r.targetId) === normDept(ctx.department)
  );
  if (deptRule) return deptRule;
  const globalRule = rules.find(r => r.targetType === "global");
  if (globalRule) return globalRule;
  return undefined;
}

function pushSource(rule: PushRule): AccessSource {
  if (rule.targetType === "user") return "push-user";
  if (rule.targetType === "department") return "push-department";
  return "push-global";
}

export function resolveTabAccess(tab: TabLike, ctx: UserContext): AccessDecision {
  if (ctx.isAdminView) {
    if (tab.isReadOnlySync && !ctx.isLocalAdmin) {
      // For imported workspaces, normal admins don't automatically get owner access.
      // They must fall through to standard explicit checks (owner/editor/viewer).
    } else {
      return { role: "owner", source: "admin", pushed: false, locked: false, inherited: false };
    }
  }

  // 3. Explicit user deny.
  if (hasUser(tab.blockedUsers, ctx.userId)) {
    return { role: "none", source: "blocked", pushed: false, locked: false, inherited: false };
  }

  // 4. Owner / editor / allowed (explicit user grants beat push).
  const ownerHit = hasUser(tab.owners, ctx.userId);
  const editorHit = hasUser(tab.editors, ctx.userId);
  const allowedHit = hasUser(tab.allowedUsers, ctx.userId);

  // 5. Push rule lookup (used both for `pushed`/`locked` flags and as a baseline).
  const push = findPushRule(tab, ctx);

  if (ownerHit) {
    return { role: "owner", source: "owner", pushed: !!push, locked: !!push?.locked, inherited: false };
  }
  if (editorHit) {
    return { role: "editor", source: "editor", pushed: !!push, locked: !!push?.locked, inherited: false };
  }
  if (allowedHit) {
    return { role: "viewer", source: "allowed", pushed: !!push, locked: !!push?.locked, inherited: false };
  }

  // 6. Push grants viewer minimum.
  if (push) {
    return { role: "viewer", source: pushSource(push), pushed: true, locked: !!push.locked, inherited: false };
  }

  // 7. Global/Public visibility — if it's public, everyone gets viewer access.
  if ((tab as any).isGlobal || tab.isPublic) {
    return { role: "viewer", source: "global", pushed: false, locked: false, inherited: true };
  }

  // 8. Non-catalog fallback: if none of the explicit or push grants matched, it's hidden.
  if (!tab.isLibraryItem) {
    return NONE;
  }

  // 9. Catalog fallback — catalog tabs are visible to everyone by default.
  // Being "in the catalog" means anyone can discover and add this workspace.
  // If access needs to be restricted, use department access or block rules above.
  return { role: "viewer", source: "global", pushed: false, locked: false, inherited: true };
}

export function resolveSectionAccess(
  section: SectionLike,
  tab: TabLike,
  tabAccess: AccessDecision,
  ctx: UserContext
): AccessDecision {
  if (ctx.isAdminView) {
    if (section.isReadOnlySync && !ctx.isLocalAdmin) {
      // For imported workspaces, normal admins don't automatically get owner access.
    } else {
      return { role: "owner", source: "admin", pushed: false, locked: false, inherited: false };
    }
  }

  // Section is unreachable if the tab is denied (callers should already gate, but be defensive).
  if (tabAccess.role === "none") return NONE;

  // 1. Global section visibility.
  if (section.isGlobal) {
    if (hasUser(section.owners, ctx.userId)) return { role: "owner", source: "owner", pushed: false, locked: false, inherited: false };
    if (hasUser(section.editors, ctx.userId)) return { role: "editor", source: "editor", pushed: false, locked: false, inherited: false };
    return { role: "viewer", source: "global", pushed: false, locked: false, inherited: true };
  }

  // 2. Explicit user deny.
  if (hasUser(section.blockedUsers, ctx.userId)) {
    return { role: "none", source: "blocked", pushed: false, locked: false, inherited: false };
  }

  // 3. (Removed "Non-catalog sections only visible to owners" to allow tab viewers to see sections within shared/public tabs)

  // 4. Tab owners/editors manage all sections in the tab.
  if (hasUser(tab.owners, ctx.userId)) {
    return { role: "owner", source: "tab-inherit", pushed: tabAccess.pushed, locked: tabAccess.locked, inherited: true };
  }
  if (hasUser(tab.editors, ctx.userId)) {
    return { role: "editor", source: "tab-inherit", pushed: tabAccess.pushed, locked: tabAccess.locked, inherited: true };
  }

  // 5. Explicit user grants on the section itself.
  if (hasUser(section.owners, ctx.userId)) return { role: "owner", source: "owner", pushed: false, locked: false, inherited: false };
  if (hasUser(section.editors, ctx.userId)) return { role: "editor", source: "editor", pushed: false, locked: false, inherited: false };
  if (hasUser(section.allowedUsers, ctx.userId)) return { role: "viewer", source: "allowed", pushed: false, locked: false, inherited: false };



  // 7. Inherit visibility from the tab — having tab access means seeing its content.
  // (We've already returned NONE above when tabAccess.role === "none", so reaching
  // here means the user has tab access.)
  return {
    role: "viewer",
    source: "tab-inherit",
    pushed: tabAccess.pushed,
    locked: tabAccess.locked,
    inherited: true,
  };
}

export function canViewTab(tab: TabLike, ctx: UserContext): boolean {
  return resolveTabAccess(tab, ctx).role !== "none";
}

export function canViewSection(section: SectionLike, tab: TabLike, ctx: UserContext): boolean {
  const tabAccess = resolveTabAccess(tab, ctx);
  return resolveSectionAccess(section, tab, tabAccess, ctx).role !== "none";
}
