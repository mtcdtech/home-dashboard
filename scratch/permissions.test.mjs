// Deterministic spec tests for the permissions resolver.
//
// This file embeds a pure-JS port of src/lib/permissions.ts so it can run
// directly with `node scratch/permissions.test.mjs`. The TS module and this
// port MUST stay behaviorally identical — when you change one, change the
// other and run this script to verify.
//
// Run: node scratch/permissions.test.mjs

// ---------- Resolver port (mirrors src/lib/permissions.ts) ----------
const NONE = { role: "none", source: "none", pushed: false, locked: false, inherited: false };

const normDept = (d) => (d || "").toLowerCase().trim();
const hasUser = (list, userId) => Array.isArray(list) && list.some((u) => u.id === userId);

function buildUserContext({ userId, dashboardGroup, isAdminView }) {
  return { userId, department: dashboardGroup || "General", isAdminView };
}

function findPushRule(tab, ctx) {
  const rules = tab.pushRules || [];
  const userRule = rules.find((r) => r.targetType === "user" && r.targetId === ctx.userId);
  if (userRule) return userRule;
  const deptRule = rules.find(
    (r) => r.targetType === "department" && normDept(r.targetId) === normDept(ctx.department)
  );
  if (deptRule) return deptRule;
  const globalRule = rules.find((r) => r.targetType === "global");
  if (globalRule) return globalRule;
  return undefined;
}

function pushSource(rule) {
  if (rule.targetType === "user") return "push-user";
  if (rule.targetType === "department") return "push-department";
  return "push-global";
}

function resolveTabAccess(tab, ctx) {
  if (ctx.isAdminView) return { role: "owner", source: "admin", pushed: false, locked: false, inherited: false };

  if (tab.isGlobal) {
    if (hasUser(tab.owners, ctx.userId)) return { role: "owner", source: "owner", pushed: false, locked: false, inherited: false };
    if (hasUser(tab.editors, ctx.userId)) return { role: "editor", source: "editor", pushed: false, locked: false, inherited: false };
    return { role: "viewer", source: "global", pushed: false, locked: false, inherited: true };
  }

  if (hasUser(tab.blockedUsers, ctx.userId)) {
    return { role: "none", source: "blocked", pushed: false, locked: false, inherited: false };
  }

  if (!tab.isLibraryItem) {
    if (hasUser(tab.owners, ctx.userId)) {
      return { role: "owner", source: "non-catalog-owner", pushed: false, locked: false, inherited: false };
    }
    return { ...NONE };
  }

  const ownerHit = hasUser(tab.owners, ctx.userId);
  const editorHit = hasUser(tab.editors, ctx.userId);
  const allowedHit = hasUser(tab.allowedUsers, ctx.userId);
  const push = findPushRule(tab, ctx);

  if (ownerHit) return { role: "owner", source: "owner", pushed: !!push, locked: !!(push && push.locked), inherited: false };
  if (editorHit) return { role: "editor", source: "editor", pushed: !!push, locked: !!(push && push.locked), inherited: false };
  if (allowedHit) return { role: "viewer", source: "allowed", pushed: !!push, locked: !!(push && push.locked), inherited: false };

  if (push) {
    return { role: "viewer", source: pushSource(push), pushed: true, locked: !!push.locked, inherited: false };
  }

  const deptRecord = (tab.departmentAccess || []).find(
    (da) => normDept(da.department) === normDept(ctx.department)
  );
  if (deptRecord) {
    if (deptRecord.role === "none") {
      return { role: "none", source: "department-deny", pushed: false, locked: false, inherited: true };
    }
    const role = deptRecord.role || "viewer";
    return { role, source: "department", pushed: false, locked: false, inherited: true };
  }

  return { ...NONE };
}

function resolveSectionAccess(section, tab, tabAccess, ctx) {
  if (ctx.isAdminView) return { role: "owner", source: "admin", pushed: false, locked: false, inherited: false };
  if (tabAccess.role === "none") return { ...NONE };

  if (section.isGlobal) {
    if (hasUser(section.owners, ctx.userId)) return { role: "owner", source: "owner", pushed: false, locked: false, inherited: false };
    if (hasUser(section.editors, ctx.userId)) return { role: "editor", source: "editor", pushed: false, locked: false, inherited: false };
    return { role: "viewer", source: "global", pushed: false, locked: false, inherited: true };
  }

  if (hasUser(section.blockedUsers, ctx.userId)) {
    return { role: "none", source: "blocked", pushed: false, locked: false, inherited: false };
  }

  if (!section.isLibraryItem) {
    if (hasUser(section.owners, ctx.userId)) {
      return { role: "owner", source: "non-catalog-owner", pushed: false, locked: false, inherited: false };
    }
    return { ...NONE };
  }

  if (hasUser(tab.owners, ctx.userId)) {
    return { role: "owner", source: "tab-inherit", pushed: tabAccess.pushed, locked: tabAccess.locked, inherited: true };
  }
  if (hasUser(tab.editors, ctx.userId)) {
    return { role: "editor", source: "tab-inherit", pushed: tabAccess.pushed, locked: tabAccess.locked, inherited: true };
  }

  if (hasUser(section.owners, ctx.userId)) return { role: "owner", source: "owner", pushed: false, locked: false, inherited: false };
  if (hasUser(section.editors, ctx.userId)) return { role: "editor", source: "editor", pushed: false, locked: false, inherited: false };
  if (hasUser(section.allowedUsers, ctx.userId)) return { role: "viewer", source: "allowed", pushed: false, locked: false, inherited: false };

  const deptRecord = (section.departmentAccess || []).find(
    (da) => normDept(da.department) === normDept(ctx.department)
  );
  if (deptRecord) {
    if (deptRecord.role === "none") {
      return { role: "none", source: "department-deny", pushed: false, locked: false, inherited: true };
    }
    const role = deptRecord.role || "viewer";
    return { role, source: "department", pushed: false, locked: false, inherited: true };
  }

  // tabAccess.role !== "none" is guaranteed here (early return above).
  return { role: "viewer", source: "tab-inherit", pushed: tabAccess.pushed, locked: tabAccess.locked, inherited: true };
}

// ---------- Tiny test harness ----------
let pass = 0;
let fail = 0;
const failures = [];

function expect(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    failures.push({ label, actual: a, expected: e });
    console.log(`  FAIL ${label}\n       got: ${a}\n       want: ${e}`);
  }
}

const ALICE = { id: "alice" };
const BOB = { id: "bob" };
const CAROL = { id: "carol" };

const aliceCtx = buildUserContext({ userId: "alice", dashboardGroup: "Engineering", isAdminView: false });
const bobCtx = buildUserContext({ userId: "bob", dashboardGroup: "Sales", isAdminView: false });
const adminCtx = buildUserContext({ userId: "admin", dashboardGroup: "Engineering", isAdminView: true });

console.log("permissions resolver tests");

// 1. Admin view always grants owner.
expect(
  "admin view → owner regardless of tab state",
  resolveTabAccess({ id: "t1", isLibraryItem: false }, adminCtx),
  { role: "owner", source: "admin", pushed: false, locked: false, inherited: false }
);

// 2. Non-catalog tab visible only to its owner.
expect(
  "non-catalog tab: owner sees as owner",
  resolveTabAccess({ id: "t2", isLibraryItem: false, owners: [ALICE] }, aliceCtx),
  { role: "owner", source: "non-catalog-owner", pushed: false, locked: false, inherited: false }
);

// 3. Non-catalog tab hidden from non-owner.
expect(
  "non-catalog tab: stranger denied",
  resolveTabAccess({ id: "t3", isLibraryItem: false, owners: [ALICE] }, bobCtx),
  NONE
);

// 4. isGlobal grants viewer to all (and overrides nothing-set).
expect(
  "isGlobal grants viewer (inherited)",
  resolveTabAccess({ id: "t4", isGlobal: true, isLibraryItem: true }, bobCtx),
  { role: "viewer", source: "global", pushed: false, locked: false, inherited: true }
);

// 5. isGlobal still elevates owners.
expect(
  "isGlobal: owner stays owner",
  resolveTabAccess({ id: "t4o", isGlobal: true, isLibraryItem: true, owners: [ALICE] }, aliceCtx),
  { role: "owner", source: "owner", pushed: false, locked: false, inherited: false }
);

// 6. blockedUsers denies even with allowed.
expect(
  "blockedUsers overrides allowedUsers",
  resolveTabAccess(
    { id: "t5", isLibraryItem: true, blockedUsers: [ALICE], allowedUsers: [ALICE] },
    aliceCtx
  ),
  { role: "none", source: "blocked", pushed: false, locked: false, inherited: false }
);

// 7. Push rule grants viewer minimum.
expect(
  "push-user grants viewer",
  resolveTabAccess(
    { id: "t6", isLibraryItem: true, pushRules: [{ targetType: "user", targetId: "alice" }] },
    aliceCtx
  ),
  { role: "viewer", source: "push-user", pushed: true, locked: false, inherited: false }
);

// 8. Locked push surfaces locked: true.
expect(
  "push-user locked surfaces locked flag",
  resolveTabAccess(
    { id: "t7", isLibraryItem: true, pushRules: [{ targetType: "user", targetId: "alice", locked: true }] },
    aliceCtx
  ),
  { role: "viewer", source: "push-user", pushed: true, locked: true, inherited: false }
);

// 9. Push by department matches case-insensitively.
expect(
  "push-department case-insensitive match",
  resolveTabAccess(
    { id: "t8", isLibraryItem: true, pushRules: [{ targetType: "department", targetId: "engineering" }] },
    aliceCtx
  ),
  { role: "viewer", source: "push-department", pushed: true, locked: false, inherited: false }
);

// 10. Push global grants viewer to all departments.
expect(
  "push-global grants viewer to anyone",
  resolveTabAccess(
    { id: "t9", isLibraryItem: true, pushRules: [{ targetType: "global", targetId: null }] },
    bobCtx
  ),
  { role: "viewer", source: "push-global", pushed: true, locked: false, inherited: false }
);

// 11. Owner role beats a non-locked push (role stays owner, pushed flag still set).
expect(
  "owner with push: role=owner, pushed=true",
  resolveTabAccess(
    {
      id: "t10",
      isLibraryItem: true,
      owners: [ALICE],
      pushRules: [{ targetType: "user", targetId: "alice", locked: true }],
    },
    aliceCtx
  ),
  { role: "owner", source: "owner", pushed: true, locked: true, inherited: false }
);

// 12. Department viewer access via departmentAccess.
expect(
  "departmentAccess viewer",
  resolveTabAccess(
    {
      id: "t11",
      isLibraryItem: true,
      departmentAccess: [{ department: "Engineering", role: "viewer" }],
    },
    aliceCtx
  ),
  { role: "viewer", source: "department", pushed: false, locked: false, inherited: true }
);

// 13. Department deny.
expect(
  "departmentAccess role=none denies",
  resolveTabAccess(
    {
      id: "t12",
      isLibraryItem: true,
      departmentAccess: [{ department: "Engineering", role: "none" }],
    },
    aliceCtx
  ),
  { role: "none", source: "department-deny", pushed: false, locked: false, inherited: true }
);

// 14. No grant at all → none.
expect(
  "catalog tab with no rules → none",
  resolveTabAccess({ id: "t13", isLibraryItem: true }, bobCtx),
  NONE
);

// --- Section tests ---

const tabAlice = {
  id: "tabA",
  isLibraryItem: true,
  owners: [ALICE],
  editors: [],
  allowedUsers: [],
  pushRules: [],
};
const aliceTabAccess = resolveTabAccess(tabAlice, aliceCtx);

// 15. Tab owner sees ALL sections (even non-catalog they don't own) — actually: non-catalog
//     section is owner-only by spec. Test: tab owner sees a CATALOG section as owner.
expect(
  "tab owner sees catalog section as owner via tab-inherit",
  resolveSectionAccess(
    { id: "s1", isLibraryItem: true },
    tabAlice,
    aliceTabAccess,
    aliceCtx
  ),
  { role: "owner", source: "tab-inherit", pushed: false, locked: false, inherited: true }
);

// 16. Non-catalog section invisible to a tab owner who isn't the section owner.
expect(
  "non-catalog section: tab owner who isn't section owner is denied",
  resolveSectionAccess(
    { id: "s2", isLibraryItem: false, owners: [BOB] },
    tabAlice,
    aliceTabAccess,
    aliceCtx
  ),
  NONE
);

// 17. Section blockedUsers denies tab owner too.
expect(
  "section blockedUsers denies even tab owner",
  resolveSectionAccess(
    { id: "s3", isLibraryItem: true, blockedUsers: [ALICE] },
    tabAlice,
    aliceTabAccess,
    aliceCtx
  ),
  { role: "none", source: "blocked", pushed: false, locked: false, inherited: false }
);

// 18. User with push tab access inherits section visibility (viewer).
const pushedTab = {
  id: "tabPushed",
  isLibraryItem: true,
  pushRules: [{ targetType: "user", targetId: "bob" }],
};
const bobPushedAccess = resolveTabAccess(pushedTab, bobCtx);
expect(
  "pushed tab: catalog section inherits viewer + pushed flag",
  resolveSectionAccess(
    { id: "s4", isLibraryItem: true },
    pushedTab,
    bobPushedAccess,
    bobCtx
  ),
  { role: "viewer", source: "tab-inherit", pushed: true, locked: false, inherited: true }
);

// 19. Section explicit editor wins over tab-inherit viewer.
const carolViewerTab = {
  id: "tabCarol",
  isLibraryItem: true,
  allowedUsers: [CAROL],
};
const carolCtx = buildUserContext({ userId: "carol", dashboardGroup: "Sales", isAdminView: false });
const carolTabAccess = resolveTabAccess(carolViewerTab, carolCtx);
expect(
  "section explicit editor beats tab-inherit viewer",
  resolveSectionAccess(
    { id: "s5", isLibraryItem: true, editors: [CAROL] },
    carolViewerTab,
    carolTabAccess,
    carolCtx
  ),
  { role: "editor", source: "editor", pushed: false, locked: false, inherited: false }
);

// 20. Section department deny on a user who otherwise has tab access.
expect(
  "section departmentAccess role=none denies viewer with tab access",
  resolveSectionAccess(
    {
      id: "s6",
      isLibraryItem: true,
      departmentAccess: [{ department: "Sales", role: "none" }],
    },
    carolViewerTab,
    carolTabAccess,
    carolCtx
  ),
  { role: "none", source: "department-deny", pushed: false, locked: false, inherited: true }
);

// ---------- Summary ----------
const total = pass + fail;
console.log(`\n${pass}/${total} pass`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of failures) {
    console.log(`  - ${f.label}\n    got:  ${f.actual}\n    want: ${f.expected}`);
  }
  process.exit(1);
}
process.exit(0);
