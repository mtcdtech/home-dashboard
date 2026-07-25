# MTCD Home Dashboard — IAM Integration Framework

**Target repo (only touch this one):** `mtcdtech/home-dashboard`
**Do NOT touch:** any other repo. Especially do not modify `mtcdtech/admin-portal`, `mtcdtech/announcement-portal`, `mtcdtech/prayer-wall`, `mtcdtech/av-checklist`, `mtcdtech/church-wiki`, `mtcdtech/docsign`, or `mtcdtech/diagram-hub`. Those are separate deliverables.
**Version:** `1.8.0` → `1.9.0` (this is D1+D2 for home-dashboard, following the pattern used in announcements/docsign/etc.)
**Deployment scope:** Stack 58 (`homedashboard`) on `home.server.mtcd.org` ONLY. Do NOT modify Stack 59 (`homedashboard` @ `home.abraham16.com`) — the Abraham instance uses Synology SSO and is out of scope for IAM integration.
**Sunday safety:** Do not deploy this Sunday morning (07:00–13:59 local). All changes here are additive/dual-write, so any weekday evening is safe.

---

## 0. Executive Summary

The home dashboard is the last MTCD webapp with pending IAM integration. Unlike the other five webapps (announcements, docsign, prayer-wall, av-checklist, church-wiki), home-dashboard already migrated to Authentik SSO in a previous phase (see the repo's existing `authentik-plan.md`) and its **three OIDC providers already have the `mtcd_person` scope bound**. This document is D1+D2 for home-dashboard: **wire the app-side code to consume `mtcd_person_id`** using the same pattern as announcements Phase D1+D2, adapted for home-dashboard's specific complexity.

### What's different about home-dashboard

Compared to the announcements portal (the reference implementation), home-dashboard has three unique wrinkles:

1. **Five sign-in providers, not one.** `authentik-pco`, `authentik-ms`, `authentik-cc`, legacy `microsoft-entra-id`, `synology`, plus a dev-only `credentials` local admin. The pid handling must be provider-aware — Authentik providers deliver a pid, the others don't.
2. **PrismaAdapter is in use.** Unlike announcements (which stores users manually in `signIn`), home-dashboard uses `@auth/prisma-adapter` and additionally does a custom Prisma upsert inside `signIn`. Both paths need pid awareness without duplicating work.
3. **Rich local user metadata.** `User` has role fields (`isAdmin`, `canEditContent`), display fields (`msName`, `pcoName`, `ccName` + matching images), governance fields (`dashboardGroup`, `department`, `departmentOverride`), and layout preferences. The pid link must survive across all three provider logins for the same person without duplicating rows.
4. **Two deploy targets.** Stack 58 (MTCD) uses Authentik; Stack 59 (Abraham) uses Synology. All new IAM logic must **no-op gracefully** when no Authentik provider is used, so the Abraham stack keeps working without changes.
5. **Not part of Phase D3.** The admin-portal's Phase D3 (compat_mode flip + per-app scope mapping) does not apply to home-dashboard because home-dashboard was never assigned an `identity_profile` in webapps.json. That's a follow-up separately from this doc; ship D1+D2 first.

### What "IAM integration" means for this app

Concretely, three things:

- **Adopt `mtcd_person_id`** as the canonical link between the home-dashboard `User` row and the Authentik person. When Alice logs in via `authentik-pco` today and `authentik-ms` tomorrow, both sessions resolve to the **same** home-dashboard User row. Today they only unify if the emails match, which fails for shared mailboxes and shifts if PCO email changes.
- **Consume `mtcd_person_id_history`** so if the admin portal reclassifies Alice's pid (e.g. shared-flag backfill), home-dashboard still finds her existing row and doesn't create a duplicate.
- **Enrich `dashboardGroup` mapping** using `mtcd_identities` (structured identity claim) so admins can drive dashboard grouping decisions off the same source of truth used by the admin portal, without changing existing manual `dashboardGroup` overrides.

Non-goals for this ship: no compat_mode flip; no per-app scope mapping; no schema-wide rename; no removal of any existing provider or fallback.

---

## 1. Current State Reference

### 1.1 Auth stack (verified as of 2026-07-25)

- **NextAuth:** `^5.0.0-beta.30`
- **Adapter:** `@auth/prisma-adapter@^2.11.1` (PostgreSQL via Prisma 7)
- **Providers configured in `src/auth.config.ts`:**
  - `authentik-pco` — Authentik OIDC → Planning Center source
  - `authentik-ms` — Authentik OIDC → Microsoft Entra source
  - `authentik-cc` — Authentik OIDC → Church Center source
  - `microsoft-entra-id` — legacy direct Entra (only active if `AUTH_MICROSOFT_ENTRA_ID_*` env vars set)
  - `synology` — Synology SSO (only active on Stack 59)
  - `credentials` — dev-only local admin, gated by `NODE_ENV !== "production" && ENABLE_DEV_CREDENTIALS === "true"`
- **Callbacks:** `signIn` handles Prisma upsert + department + admin-group detection. `jwt` and `session` propagate id/department/isAdmin/iconSize/canEditContent.

### 1.2 Live Authentik state (verified 2026-07-25 via API)

Three providers exist and are already bound to `mtcd_person` scope:

| Provider pk | Name | Client ID | Callback URL | mtcd_person scope bound |
|---|---|---|---|---|
| 10 | Home Dashboard (Planning Center) | `vkR61gsywFjZjmGsynld8dfLOdTH2NNghTHridfE` | `/api/auth/callback/authentik-pco` | ✅ |
| 11 | Home Dashboard (Microsoft) | `AeDh5vlaxK42xDXsU0lMTflIW7NyecIL8NnGZk8j` | `/api/auth/callback/authentik-ms` | ✅ |
| 17 | home-dashboard-cc | `gW2czo0OSiHAxZ7hFoyuzWa53Zcu7QfY7pj6mleH` | `/api/auth/callback/authentik-cc` | ✅ |

Applications:
- `home-dashboard-pco` → provider 10
- `home-dashboard-ms` → provider 11
- `home-dashboard-cc` → provider 17

Groups (created but currently empty):
- `app-home-dashboard-admins` (pk `1da03c09-531a-46b8-a1a6-19833905b5bc`)
- `app-home-dashboard-global-admins` (pk `1a28c6b1-562f-4550-97bf-c9f629148b7e`)

The `mtcd_person` scope emits (per current Authentik `mtcd-person-claims` mapping expression, pk `46e9ba98-2e4a-4271-96d2-a7b51a674db9`): `mtcd_person_id`, `mtcd_login_source`, `mtcd_identities`. The scope mapping does **not** currently emit `mtcd_person_id_history` — the admin-portal Phase D3+E doc includes a small fix that adds it. Assume history may or may not be present in the id_token; code defensively for both cases (see §3.3).

### 1.3 What the app currently does with Authentik claims

In `src/auth.ts` `signIn` callback:

- If provider is `authentik-*`, the callback reads `profile.groups` and sets `isAdmin=true` if any of `app-home-dashboard-global-admins`, `app-home-dashboard-admins`, or `Authentik Admins` are present.
- Department is set to `""` for Authentik logins (blank, falling back to existing `dashboardGroup` or defaulting to "General" for new users).
- Prisma upsert is by `email` unique constraint. `msName/msImage/pcoName/pcoImage/ccName/ccImage` fields are populated based on which provider was used.

The profile object (from `src/auth.config.ts`) currently pulls only `sub`, `name`, `email`, `image`, `department`. **It does not read `mtcd_person_id`, `mtcd_login_source`, or `mtcd_identities`** from the id_token, even though they are being emitted. This is the primary gap D1 closes.

### 1.4 Prisma schema — relevant fields

The `User` model already has:
- `id` (cuid) — Prisma-managed primary key
- `email` @unique — currently the join key across providers
- `name`, `image`, `msName`, `msImage`, `pcoName`, `pcoImage`, `ccName`, `ccImage`
- `department`, `departmentOverride`, `dashboardGroup`
- `isAdmin`, `canEditContent`, `iconSize`

It does **not** have `mtcdPersonId`. That's what D1 adds.

### 1.5 Two stacks reminder

- **Stack 58** (`home.server.mtcd.org`) — MTCD, uses Authentik. **In scope.**
- **Stack 59** (`home.abraham16.com`) — Abraham, uses Synology SSO. **Out of scope.**

Both stacks build from the same Docker image (`mtcdtech/homedashboard:latest` or `:abraham`). The code changes ship to both, but must **behave identically when no Authentik env vars are set** (Abraham stack).

---

## 2. Phase D1 — Prisma Schema + Type Additions

### 2.1 Add `mtcdPersonId` to User

Edit `prisma/schema.prisma`:

```prisma
model User {
  id            String    @id @default(cuid())
  // ... existing fields ...
  email         String?   @unique
  // ... existing fields ...

  // IAM integration (2026-07 Phase D1)
  mtcdPersonId  String?   @unique
  mtcdIdentitySource String?   // "microsoft" | "planning_center" | "church_center_otp" | "microsoft_shared" | null
  mtcdLastSyncedAt DateTime?

  // ... rest unchanged ...
}
```

Notes on the schema additions:

- **`mtcdPersonId` is nullable** — existing users won't have one until they log in via Authentik post-D1, or the backfill in D2 fills them in. Users on Stack 59 (Synology) will always have `null` here, which is correct.
- **`@unique` on `mtcdPersonId`** — same reason as announcements. Enforces one home-dashboard User row per Authentik person. Prevents duplicate rows if email changes but pid is stable.
- **`mtcdIdentitySource`** — records the `mtcd_login_source` from the last login. Useful for the admin UI (§4) to show operators "which channel did this user last authenticate through". Not used for auth decisions.
- **`mtcdLastSyncedAt`** — updated on every successful login. Enables the admin UI to flag stale accounts (users who haven't logged in since IAM integration shipped).

### 2.2 Migration

Create `prisma/migrations/<timestamp>_iam_integration_add_mtcd_person_id/migration.sql`:

```sql
ALTER TABLE "User" ADD COLUMN "mtcdPersonId" TEXT;
ALTER TABLE "User" ADD COLUMN "mtcdIdentitySource" TEXT;
ALTER TABLE "User" ADD COLUMN "mtcdLastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_mtcdPersonId_key" ON "User"("mtcdPersonId");
```

Deploy with the existing `prisma migrate deploy` or `prisma db push` flow — check `Dockerfile` and `docker-entrypoint*.sh` to see which pattern the repo uses. If unclear, run `npx prisma migrate dev --name iam_integration_add_mtcd_person_id` locally to generate the migration files, then commit them.

Migration is **additive only** — no columns dropped, no unique constraints tightened on existing columns. Safe to run against a live DB.

### 2.3 NextAuth type augmentation

Edit `src/types/next-auth.d.ts`. Add to Session, User, JWT, and Profile:

```typescript
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      department?: string | null;
      isAdmin?: boolean;
      canEditContent?: boolean;
      mtcdPersonId?: string | null;
      mtcdIdentitySource?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    department?: string | null;
    isAdmin?: boolean;
    canEditContent?: boolean;
    mtcdPersonId?: string | null;
    mtcdIdentitySource?: string | null;
  }

  interface Profile {
    // Standard OIDC claims already present
    sub?: string;
    name?: string;
    email?: string;
    picture?: string | null;
    // MTCD extensions from the mtcd_person scope mapping
    mtcd_person_id?: string;
    mtcd_login_source?: "microsoft" | "planning_center" | "church_center_otp" | "microsoft_shared";
    mtcd_person_id_history?: Array<{
      previous_mtcd_person_id?: string;
      new_mtcd_person_id?: string;
      reason?: string;
      at?: string;
    }>;
    mtcd_identities?: {
      church_center?: { id?: string; email?: string; name?: string; phone?: string | null } | null;
      planning_center?: Array<{ id?: string; email?: string; name?: string }>;
      microsoft?: Array<{
        object_id?: string;
        upn?: string;
        email?: string;
        display_name?: string;
        department?: string | null;
        job_title?: string | null;
        shared?: boolean;
      }>;
    };
    // Existing Authentik claims we already consume
    groups?: string[];
    department?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    department?: string | null;
    isAdmin?: boolean;
    canEditContent?: boolean;
    mtcdPersonId?: string | null;
    mtcdIdentitySource?: string | null;
  }
}
```

Do NOT delete existing declarations — the schema-augmentation file has a bug (imports `NextAuth, { DefaultSession }` twice at the top; fix that while you're editing). The current type interfaces stay; new fields are additive.

---

## 3. Phase D1 — signIn Callback Rewrite

This is the heart of the change. The `signIn` callback in `src/auth.ts` must:

1. Detect whether an `mtcd_person_id` is available in the profile (Authentik providers) vs not (Synology, Entra direct, credentials).
2. When available, do a **3-tier user lookup** matching the announcements portal pattern.
3. When not available, fall back to the existing email-based upsert (backwards-compatible).
4. Dual-write the pid (and identity_source, last_synced_at) on every Authentik login so the local DB stays fresh.

### 3.1 Provider classification helper

Add at the top of `src/auth.ts` (or a new `src/lib/iam.ts` module — recommended for testability):

```typescript
// src/lib/iam.ts
export type IamProviderKind =
  | "authentik"       // authentik-pco | authentik-ms | authentik-cc — carries mtcd_person_id
  | "microsoft-entra" // legacy direct Entra — no mtcd_person_id
  | "synology"        // Abraham stack — no mtcd_person_id
  | "credentials"     // dev local admin — no mtcd_person_id
  | "unknown";

export function classifyProvider(providerId: string | undefined | null): IamProviderKind {
  if (!providerId) return "unknown";
  if (providerId.startsWith("authentik-")) return "authentik";
  if (providerId === "microsoft-entra-id") return "microsoft-entra";
  if (providerId === "synology") return "synology";
  if (providerId === "credentials") return "credentials";
  return "unknown";
}

export function extractPidClaims(profile: any): {
  pid: string | null;
  loginSource: string | null;
  pidHistory: Array<{ previous_mtcd_person_id?: string; new_mtcd_person_id?: string }>;
  identities: any;
} {
  if (!profile) return { pid: null, loginSource: null, pidHistory: [], identities: null };
  const pid = typeof profile.mtcd_person_id === "string" && profile.mtcd_person_id ? profile.mtcd_person_id : null;
  const loginSource = typeof profile.mtcd_login_source === "string" ? profile.mtcd_login_source : null;
  const pidHistory = Array.isArray(profile.mtcd_person_id_history) ? profile.mtcd_person_id_history : [];
  const identities = profile.mtcd_identities || null;
  return { pid, loginSource, pidHistory, identities };
}
```

### 3.2 3-tier user resolution helper

Also in `src/lib/iam.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function findExistingUserByIam({
  pid,
  pidHistory,
  email,
}: {
  pid: string | null;
  pidHistory: Array<{ previous_mtcd_person_id?: string; new_mtcd_person_id?: string }>;
  email: string | null | undefined;
}): Promise<{ user: any | null; matchedBy: "pid" | "pid_history" | "email" | null }> {
  // Tier 1: current mtcdPersonId
  if (pid) {
    const u = await prisma.user.findUnique({ where: { mtcdPersonId: pid } });
    if (u) return { user: u, matchedBy: "pid" };
  }

  // Tier 2: mtcdPersonId matches any previous_mtcd_person_id in history.
  // This handles the case where the admin portal reclassified a user's pid.
  if (pid && pidHistory.length > 0) {
    for (const entry of pidHistory) {
      const prev = entry?.previous_mtcd_person_id;
      if (!prev || prev === pid) continue;
      const u = await prisma.user.findUnique({ where: { mtcdPersonId: prev } });
      if (u) {
        // Migrate: adopt new pid on the existing row so future tier-1 lookups find it.
        // Only do this if no other row already holds the new pid (uniqueness guard).
        const conflict = await prisma.user.findUnique({ where: { mtcdPersonId: pid } });
        if (!conflict) {
          const updated = await prisma.user.update({
            where: { id: u.id },
            data: { mtcdPersonId: pid },
          });
          return { user: updated, matchedBy: "pid_history" };
        }
        // If there IS a conflict, the caller must decide (log a warning; fall through to email).
        console.warn(
          `[iam] pid history match for ${u.email} points to new pid ${pid} but another user row already holds that pid. Falling through to email match.`
        );
      }
    }
  }

  // Tier 3: email
  if (email) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) return { user: u, matchedBy: "email" };
  }

  return { user: null, matchedBy: null };
}
```

### 3.3 signIn callback — new shape

Rewrite `src/auth.ts` `signIn` callback. Preserve every existing behavior; layer pid handling in.

Pseudocode of the intended shape:

```typescript
async signIn({ user, account, profile }: any) {
  // 1. credentials: pass through unchanged
  if (account?.provider === "credentials") return true;

  try {
    const providerKind = classifyProvider(account?.provider);
    const { pid, loginSource, pidHistory, identities } = extractPidClaims(profile);

    // 2. Existing group / department logic (unchanged from current code)
    let department = "";
    let isGroupAdmin = false;
    const groups: string[] = (profile?.groups as string[]) || [];

    if (account?.provider === "microsoft-entra-id" && profile) {
      department = profile.department || "";
    } else if (account?.provider === "synology" && profile) {
      isGroupAdmin = groups.includes("administrators");
      department = isGroupAdmin ? "Admin" : "Synology";
    } else if (providerKind === "authentik") {
      isGroupAdmin =
        groups.includes("app-home-dashboard-global-admins") ||
        groups.includes("app-home-dashboard-admins") ||
        groups.includes("Authentik Admins");
      department = "";
    }
    (user as any).department = department;

    // 3. Resolve existing user
    if (!user.email && !pid) return true;  // nothing to match on; let NextAuth create a raw row

    const { user: existingUser, matchedBy } = await findExistingUserByIam({
      pid,
      pidHistory,
      email: user.email,
    });

    // 4. Compute provider-specific display name/image fields (unchanged behavior)
    let msName = existingUser?.msName ?? null;
    let msImage = existingUser?.msImage ?? null;
    let pcoName = existingUser?.pcoName ?? null;
    let pcoImage = existingUser?.pcoImage ?? null;
    let ccName = existingUser?.ccName ?? null;
    let ccImage = existingUser?.ccImage ?? null;

    if (account?.provider === "authentik-ms") {
      msName = user.name || msName;
      msImage = user.image || msImage;
    } else if (account?.provider === "authentik-pco") {
      pcoName = user.name || pcoName;
      pcoImage = user.image || pcoImage;
    } else if (account?.provider === "authentik-cc") {
      ccName = user.name || ccName;
      ccImage = user.image || ccImage;
    }

    const finalName = msName || pcoName || ccName || user.name;
    const finalImage = msImage || pcoImage || ccImage || user.image;

    // 5. Build update payload — include mtcdPersonId only when we have one
    const iamPayload: any = {};
    if (pid) {
      iamPayload.mtcdPersonId = pid;
      iamPayload.mtcdLastSyncedAt = new Date();
    }
    if (loginSource) {
      iamPayload.mtcdIdentitySource = loginSource;
    }

    // 6. Upsert. If we have an existingUser row, update it. Otherwise create.
    let dbUser;
    if (existingUser) {
      dbUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: finalName,
          image: finalImage,
          msName, msImage, pcoName, pcoImage, ccName, ccImage,
          department,
          ...(department && !existingUser.dashboardGroup ? { dashboardGroup: department } : {}),
          ...(isGroupAdmin ? { isAdmin: true } : {}),
          // Also update email if it changed (protect against uniqueness violation)
          ...(user.email && user.email !== existingUser.email
            ? await safeEmailUpdate(user.email, existingUser.id)
            : {}),
          ...iamPayload,
        },
      });
    } else {
      // Fresh signup path — email is required for uniqueness (existing constraint)
      if (!user.email) {
        console.error("[iam] no email and no existing user; refusing to create anonymous row");
        return false;
      }
      dbUser = await prisma.user.create({
        data: {
          name: finalName,
          email: user.email,
          image: finalImage,
          msName, msImage, pcoName, pcoImage, ccName, ccImage,
          department,
          dashboardGroup: department || "General",
          isAdmin: isGroupAdmin,
          ...iamPayload,
        },
      });

      // Auto-assign workspaces flagged as "push to new users" (existing behavior, unchanged)
      try {
        const pushTabs = await prisma.tab.findMany({
          where: { pushToNewUsers: true },
          select: { id: true },
        });
        if (pushTabs.length > 0) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { allowedTabs: { connect: pushTabs.map(t => ({ id: t.id })) } },
          });
        }
      } catch (e) { console.error("pushToNewUsers failed:", e); }
    }

    // 7. Hydrate user object for jwt callback (unchanged)
    user.id = dbUser.id;
    user.name = dbUser.name;
    user.image = dbUser.image;
    (user as any).isAdmin = dbUser.isAdmin;
    (user as any).iconSize = dbUser.iconSize;
    (user as any).canEditContent = dbUser.canEditContent;
    (user as any).mtcdPersonId = dbUser.mtcdPersonId;
    (user as any).mtcdIdentitySource = dbUser.mtcdIdentitySource;

    // 8. Activity log (unchanged, but include matchedBy for diagnostics)
    (prisma as any).activityLog.create({
      data: {
        userId: dbUser.id,
        userName: user.name || user.email,
        type: "login",
        detail: `via ${account?.provider || "SSO"}${matchedBy ? ` (matched=${matchedBy})` : ""}${pid ? ` pid=${pid}` : ""}`,
      },
    }).catch(() => {});

    return true;
  } catch (err) {
    console.error("SignIn error:", err);
    return true;  // preserve current behavior of failing open — do not lock users out on a soft error
  }
}
```

Helper `safeEmailUpdate` handles the case where the incoming email is already taken by a different row (rare but possible if two people share an email history):

```typescript
async function safeEmailUpdate(newEmail: string, thisUserId: string): Promise<{ email?: string }> {
  const conflict = await prisma.user.findUnique({ where: { email: newEmail } });
  if (conflict && conflict.id !== thisUserId) {
    console.warn(`[iam] email ${newEmail} already used by user ${conflict.id}; keeping existing email on ${thisUserId}`);
    return {};
  }
  return { email: newEmail };
}
```

### 3.4 jwt and session callback additions

In `jwt` callback, add:

```typescript
if (user) {
  token.mtcdPersonId = (user as any).mtcdPersonId;
  token.mtcdIdentitySource = (user as any).mtcdIdentitySource;
}
```

In `session` callback, propagate to session.user:

```typescript
if (session.user && token) {
  session.user.mtcdPersonId = token.mtcdPersonId ?? null;
  session.user.mtcdIdentitySource = token.mtcdIdentitySource ?? null;
}
```

### 3.5 Behavior matrix — verify these cases work

Write out this table in the PR description as the acceptance-criteria for D1. Each row must be tested manually or covered by tests (§8):

| # | Scenario | Provider | Existing row? | Expected result |
|---|---|---|---|---|
| 1 | Fresh user, first-ever login via PCO | authentik-pco | none | Create User with pid=X, dashboardGroup=General, isAdmin=false |
| 2 | Same user, next day, logs in via MS | authentik-ms | pid=X existing | Match by pid (tier 1). Update pcoName + msName both preserved. No duplicate row. |
| 3 | Existing user (pre-IAM, no pid), logs in via authentik-pco | authentik-pco | email match, pid null | Match by email (tier 3). Write pid=X to existing row. |
| 4 | User whose pid was reclassified by admin portal | authentik-ms | pid=Y existing, but claim says pid=X with history[{previous: Y}] | Match by pid_history (tier 2). Update row's mtcdPersonId to X. |
| 5 | Local admin dev login | credentials | admin@local.host | Pass-through, no IAM logic. |
| 6 | Synology login (Abraham stack) | synology | any | Existing email upsert path, no pid. |
| 7 | Legacy Entra login (Abraham stack fallback) | microsoft-entra-id | any | Existing email upsert path, no pid. |
| 8 | Shared mailbox login via MS (rare) | authentik-ms | pid=mtcd_shared_* | Create/update row with pid=mtcd_shared_*, loginSource="microsoft_shared". Admin UI (§4) can filter these. |
| 9 | Authentik profile has pid but user has no email | authentik-cc | may match by pid | Match by pid; if no existing row, refuse to create (email required by schema). |
| 10 | Two Authentik rows share a pid (bug case) | authentik-* | multiple matches on pid | `findUnique` returns first — safe due to `@unique` at DB level. Should never happen. |

---

## 4. Phase D2 — Backfill Script

### 4.1 Design

Similar to announcements' `scripts/backfill-mtcd-person-ids.ts` but adapted for home-dashboard's Prisma User schema:

- Fetch `https://admin.server.mtcd.org/iam/api/export/users` (public export endpoint — no auth required per the admin-portal spec).
- For each home-dashboard User row where `mtcdPersonId IS NULL`:
  - Try to match by `email` against the export's `email`, `ms_email`, `pco_email`, `cc_email`, and `emails[]` arrays.
  - On unique match, set `mtcdPersonId` + `mtcdIdentitySource` + `mtcdLastSyncedAt`.
  - On zero matches, log and skip.
  - On multiple matches (ambiguous email), log a warning and skip — operator must resolve manually via the admin UI (§4.5).
- Report a summary: matched, ambiguous, unmatched, already-had-pid.
- Support `--dry-run` (default) and `--apply` flags.

### 4.2 File: `scripts/backfill-mtcd-person-ids.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IAM_EXPORT_URL =
  process.env.IAM_EXPORT_URL || "https://admin.server.mtcd.org/iam/api/export/users";

type IamPerson = {
  mtcd_person_id: string;
  email?: string | null;
  ms_email?: string | null;
  pco_email?: string | null;
  cc_email?: string | null;
  emails?: string[];
  mtcd_login_source?: string | null;
};

function normalizeEmail(e?: string | null): string | null {
  if (!e || typeof e !== "string") return null;
  return e.trim().toLowerCase() || null;
}

function collectPersonEmails(p: IamPerson): Set<string> {
  const emails = new Set<string>();
  const push = (e?: string | null) => { const n = normalizeEmail(e); if (n) emails.add(n); };
  push(p.email);
  push(p.ms_email);
  push(p.pco_email);
  push(p.cc_email);
  (p.emails || []).forEach(push);
  return emails;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  console.log(`[backfill] Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);

  // 1. Fetch IAM export
  console.log(`[backfill] Fetching ${IAM_EXPORT_URL}`);
  const resp = await fetch(IAM_EXPORT_URL);
  if (!resp.ok) throw new Error(`IAM export fetch failed: ${resp.status}`);
  const data = await resp.json();
  const people: IamPerson[] = Array.isArray(data) ? data : (data.users || []);
  console.log(`[backfill] Fetched ${people.length} people from IAM`);

  // 2. Build email → pid[] index (tolerate multi-mapped emails)
  const emailIndex = new Map<string, string[]>();
  for (const p of people) {
    if (!p.mtcd_person_id) continue;
    for (const e of collectPersonEmails(p)) {
      const arr = emailIndex.get(e) || [];
      if (!arr.includes(p.mtcd_person_id)) arr.push(p.mtcd_person_id);
      emailIndex.set(e, arr);
    }
  }

  // Build a lookup for pid → source
  const sourceByPid = new Map<string, string>();
  for (const p of people) {
    if (p.mtcd_person_id && p.mtcd_login_source) {
      sourceByPid.set(p.mtcd_person_id, p.mtcd_login_source);
    }
  }

  // 3. Iterate local Users
  const users = await prisma.user.findMany({
    where: { mtcdPersonId: null },
    select: { id: true, email: true, name: true },
  });
  console.log(`[backfill] Local Users without pid: ${users.length}`);

  const stats = { matched: 0, ambiguous: 0, unmatched: 0, alreadyTaken: 0, applied: 0 };
  const rows: any[] = [];

  for (const u of users) {
    const email = normalizeEmail(u.email);
    if (!email) { stats.unmatched++; rows.push({ id: u.id, email: u.email, status: "no_email" }); continue; }
    const pids = emailIndex.get(email) || [];
    if (pids.length === 0) {
      stats.unmatched++;
      rows.push({ id: u.id, email, status: "unmatched" });
      continue;
    }
    if (pids.length > 1) {
      stats.ambiguous++;
      rows.push({ id: u.id, email, status: "ambiguous", pids });
      continue;
    }
    const pid = pids[0];

    // Guard: is this pid already claimed by another local User? (Should be rare.)
    const existing = await prisma.user.findUnique({ where: { mtcdPersonId: pid } });
    if (existing && existing.id !== u.id) {
      stats.alreadyTaken++;
      rows.push({ id: u.id, email, status: "pid_taken_by", pid, takenBy: existing.id });
      continue;
    }

    stats.matched++;
    rows.push({ id: u.id, email, status: "match", pid });

    if (apply) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          mtcdPersonId: pid,
          mtcdIdentitySource: sourceByPid.get(pid) || null,
          mtcdLastSyncedAt: new Date(),
        },
      });
      stats.applied++;
    }
  }

  console.log("\n[backfill] Summary:", stats);

  // Emit CSV for operator review
  const outFile = `backfill-report-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  const csv = [
    "id,email,status,pid,notes",
    ...rows.map(r =>
      [
        r.id,
        r.email || "",
        r.status,
        r.pid || (r.pids || []).join("|"),
        r.takenBy ? `takenBy=${r.takenBy}` : "",
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  await import("fs").then(fs => fs.promises.writeFile(outFile, csv));
  console.log(`[backfill] CSV written to ${outFile}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Add to `package.json` scripts:

```json
"scripts": {
  "backfill:iam": "tsx scripts/backfill-mtcd-person-ids.ts",
  "backfill:iam:apply": "tsx scripts/backfill-mtcd-person-ids.ts --apply"
}
```

(If `tsx` is not already a dev dependency, add it. Verify vs the existing `scripts` block.)

### 4.3 Running the backfill

1. Wait until D1 is deployed and stable for 24h (some users will self-heal via login).
2. Run dry-run: `pnpm backfill:iam` (or `npm run backfill:iam`). Review the CSV.
3. If dry-run looks clean (< 5 ambiguous, < 20 unmatched, 0 already-taken), run `pnpm backfill:iam:apply`.
4. Re-check the CSV to confirm applied count matches the dry-run "match" count.

### 4.4 What to do with unmatched/ambiguous rows

These are surfaced in the admin UI (§4.5) as a dedicated "Unlinked from IAM" tab. Operator options:

- **Ambiguous:** operator picks the correct pid from a dropdown.
- **Unmatched:** operator can either mark the user as "Local only" (dashboardGroup=General, no IAM link) or delete the row if it was an orphaned Prisma record.

### 4.5 Admin UI — new "IAM Link" panel

Extend `src/app/admin/users/UserBoard.tsx` (or add a new tab) to expose:

- **Per-user column: IAM Link.** Shows the `mtcdPersonId` if present. Clickable to open a small modal that displays `mtcdIdentitySource` and links to the admin-portal user profile (`https://admin.server.mtcd.org/iam/users?pid=<pid>` — check exact URL pattern in admin-portal; if it doesn't exist yet, just show the pid as text).
- **"Unlinked users" filter chip.** Filters the board to users with `mtcdPersonId IS NULL`. Count badge on the tab.
- **Manual link button.** For an unlinked user, an operator can paste a `mtcd_person_id` and manually claim it. Validates against the IAM export API before writing (must match a real person).
- **"Sync from IAM" button (dry-run + apply).** Kicks off the backfill logic from the admin UI (calls a new `/api/admin/iam/backfill` server action that runs the same code as the script — same dry-run/apply semantics).

Do NOT add a "delete user" button here — that already exists elsewhere in the admin UI. Do NOT auto-run the backfill on server startup — always operator-initiated.

New server actions in `src/app/admin/actions.ts`:

```typescript
export async function iamBackfillDryRun() { await requireAdmin(); /* run script logic, return summary + rows */ }
export async function iamBackfillApply() { await requireAdmin(); /* run with --apply */ }
export async function iamManualLink(userId: string, pid: string) {
  await requireAdmin();
  // Validate pid exists in IAM export
  // Guard: not already claimed by another local User
  // Update user
}
export async function iamUnlink(userId: string) {
  await requireAdmin();
  // Set mtcdPersonId=null on the user. Useful if operator wants to force re-link on next login.
}
```

---

## 5. Optional: Admin Group Provisioning

Once D1+D2 are stable, an optional follow-up is to make **the home-dashboard admin group membership drive `isAdmin`** on the local User record more reliably. Two enhancements:

### 5.1 Backfill admin group membership

The two Authentik groups `app-home-dashboard-admins` and `app-home-dashboard-global-admins` are currently empty (verified 2026-07-25). Populate them via the admin-portal UI or Authentik directly. Once populated, users in those groups get `isAdmin=true` automatically on next login (this already works via the existing `signIn` group check).

**Don't do this as part of this ship.** Populating the group is a separate operator decision that depends on the current admin roster in home-dashboard. Do it after D1+D2 have verified the group-membership check still works.

### 5.2 De-admin logic on group removal

Currently, `signIn` sets `isAdmin: true` when the group is present but **never sets it back to false when the group is removed** — because the `update` payload only includes `isAdmin` when `isGroupAdmin` is true. This is intentional (admins have often been granted locally without a group), but risky if the goal is to make Authentik the source of truth for admin status.

Do NOT change this in D1+D2. Document it as a known behavior in the "future work" section of the PR. A future toggle in Admin settings (`Prefer IAM group as source of truth for isAdmin`) can drive whether we sync down or additively grant.

---

## 6. What NOT to Do

- **Do not** modify anything under `mtcdtech/admin-portal`, `mtcdtech/announcement-portal`, `mtcdtech/prayer-wall`, `mtcdtech/av-checklist`, `mtcdtech/church-wiki`, `mtcdtech/docsign`, `mtcdtech/diagram-hub`, or `mtcdtech/drawio-*`.
- **Do not** create any new Authentik providers, applications, or scope mappings. The three providers (pk 10, 11, 17) already exist and are already bound to `mtcd_person` — nothing to add server-side.
- **Do not** flip any `identity_profile.compat_mode` — home-dashboard isn't even in the admin portal's compat_mode webapps list. That's a Phase D3 concern being tracked in the admin-portal Phase D3+E doc; home-dashboard will be added there separately.
- **Do not** touch Stack 59 (`home.abraham16.com`). The Abraham deployment has no Authentik provider and must continue to work with Synology + Entra fallback.
- **Do not** remove any existing provider (`microsoft-entra-id`, `synology`, `credentials`). Keep all of them.
- **Do not** change the primary key semantics. `User.id` stays as the cuid primary key; `mtcdPersonId` is a secondary unique index only.
- **Do not** run the backfill in production without operator confirmation. Ship the script, ship the admin UI trigger, but do not add it to a cron or startup hook.

---

## 7. Environment Variables

No new environment variables required for D1+D2. The IAM export URL is hardcoded default `https://admin.server.mtcd.org/iam/api/export/users` in the backfill script; overridable via `IAM_EXPORT_URL` if needed (e.g., for testing against a staging admin portal).

No new secrets required — the IAM export endpoint is public per the admin-portal spec.

If you want to verify:

```bash
curl -sk 'https://admin.server.mtcd.org/iam/api/export/users' | head -c 500
```

Should return a JSON payload with `users` or a top-level array.

---

## 8. Testing

Add a new test file `src/lib/iam.test.ts` (or use whichever test runner is already configured — check `package.json` for `jest`, `vitest`, or `node --test`):

1. **`test_classifyProvider`** — validates all provider IDs classify correctly.
2. **`test_extractPidClaims_shape`** — feeds a full profile, checks the 4 return fields.
3. **`test_extractPidClaims_missing`** — feeds a profile without `mtcd_person_id`; returns null pid.
4. **`test_findExistingUserByIam_tier1_pid`** — seed a user with pid=X, look up by pid=X, expect tier "pid".
5. **`test_findExistingUserByIam_tier2_history`** — seed user with pid=Y, call with pid=X + history=[{previous: Y}], expect tier "pid_history" AND row's pid updated to X.
6. **`test_findExistingUserByIam_tier2_conflict`** — seed users A (pid=Y) and B (pid=X). Call with pid=X + history=[{previous: Y}]. Expect fallthrough to email match (do NOT clobber B).
7. **`test_findExistingUserByIam_tier3_email`** — seed user with pid=null, email=alice@; look up with pid=X, email=alice@; expect tier "email".
8. **`test_findExistingUserByIam_none`** — no matches, return { user: null, matchedBy: null }.
9. **`test_signIn_authentik_pco_new_user`** — mock profile with pid, no existing row; verify creates row with pid.
10. **`test_signIn_authentik_ms_after_pco`** — same pid across two logins; verify no duplicate row, msName gets populated on top of pcoName.
11. **`test_signIn_synology_no_pid`** — verify Synology login still works exactly as before (no pid, no crashes).
12. **`test_signIn_credentials_passthrough`** — credentials login returns true without hitting IAM logic.
13. **`test_backfill_dry_run_no_writes`** — mock fetch + prisma; verify no `update` calls issued in dry-run.
14. **`test_backfill_apply_writes_pid`** — mock fetch + prisma; verify update calls issued with expected pid.
15. **`test_backfill_ambiguous_skipped`** — feed an email that maps to 2 pids; verify skipped, row status="ambiguous".

Also add an **integration smoke check** to `package.json`: a script that starts the dev server, hits the login page, and verifies it renders. If Playwright/Cypress isn't set up, skip this — manual verify in staging.

---

## 9. Deployment

Same pattern as the existing `authentik-plan.md` Phase 3 in this repo:

1. Merge the PR to `main`.
2. GitHub Actions builds `mtcdtech/homedashboard:latest` (and `:abraham` if the branch pattern is right).
3. The workflow triggers `update_portainer.py` which redeploys Stack 58 (`home.server.mtcd.org`).
4. Prisma migration runs on container start (verify via `docker logs stack_58_containername | grep migrate`).
5. Verify the version banner reads `v1.9.0` at `https://home.server.mtcd.org/`.

For **Stack 59 (Abraham)** — the same image ships but the migration also runs. That's fine because the schema addition is additive; no data loss, no behavior change (no Authentik provider configured on that stack means `mtcdPersonId` stays null for all users there).

### Rollback

- Code rollback: revert the PR and redeploy. `mtcdPersonId` column remains in the DB but nothing writes to it — harmless dead column.
- Data rollback: none needed. Dual-write pattern means the app runs identically whether or not pid values are present.

---

## 10. Verification Checklist (Post-Deploy)

Run in order after Stack 58 is live at `v1.9.0`:

- [ ] `curl -sk https://home.server.mtcd.org/ | grep -oE 'v1\.[0-9.]+'` returns `v1.9.0`.
- [ ] Log in via **Planning Center** button. Container logs should show `matched=email` or `matched=pid` and `pid=mtcd_...` in the activity log entry.
- [ ] In Postgres, verify: `SELECT COUNT(*) FROM "User" WHERE "mtcdPersonId" IS NOT NULL;` — should be at least 1 after your login.
- [ ] Log in via **Microsoft** button (same real person). Verify no duplicate User row created; same row updated with `msName` populated alongside `pcoName`.
- [ ] Log in via **Church Center** button. Same row again; `ccName` populated.
- [ ] Verify `activityLog` entries for the three logins reference the same `userId`.
- [ ] Log in via **credentials** (dev, if enabled). Verify no IAM logic runs (log line "Credentials login attempt for: admin", no `matched=` string).
- [ ] Run `pnpm backfill:iam` (dry-run) and review the CSV. Report matched/unmatched/ambiguous counts to the operator.
- [ ] If dry-run is clean, run `pnpm backfill:iam:apply` and verify applied count matches.
- [ ] Verify **Stack 59 (Abraham)** still works: log in via Synology at `home.abraham16.com`, verify no crashes, `mtcdPersonId` stays null on that user's row.
- [ ] In admin UI, verify the new "IAM Link" column renders and the "Unlinked users" filter works.
- [ ] Verify `identity_profile_flip_history` (from admin-portal) shows no home-dashboard entry — this ship does not touch compat_mode.

---

## 11. Follow-Up Work (Not This Ship)

Track these for future iterations after D1+D2 have been stable for at least 2 weeks:

1. **Register home-dashboard in admin-portal's `webapps.json`.** Currently the admin portal's `KNOWN_COMPAT_PROFILES` list (in `modules/iam/storage.py`) has entries for announcement-portal, docsign, diagram-hub, church-wiki, av-checklist, prayer-wall — but NOT home-dashboard. Once home-dashboard is IAM-integrated, add it there so the admin portal can eventually flip its compat_mode (Phase D3 for home-dashboard).
2. **Backfill Authentik group memberships.** Populate `app-home-dashboard-admins` and `app-home-dashboard-global-admins` in Authentik so IAM becomes the source of truth for admin status.
3. **Add "Prefer IAM group as isAdmin source" toggle.** Global setting that switches `signIn` from additive-grant to sync-down semantics for `isAdmin`. (See §5.2.)
4. **Add optional dashboardGroup auto-mapping** driven by `mtcd_identities.microsoft[].department`. Currently blank for Authentik logins; could seed the default group from MS `department` field on first login only.
5. **Shared mailbox UX.** When someone logs in via a shared mailbox account (loginSource="microsoft_shared", pid starts with `mtcd_shared_`), show a banner: "You are logged in as a shared mailbox account. Individual preferences will not be saved." Or block it entirely for the dashboard — depends on operator preference.
6. **Extend the admin UI's IAM Link panel with a live IAM search.** Type-ahead against `admin.server.mtcd.org/iam/api/search/...` to find and link a person without knowing their pid.

None of these are prerequisites for shipping D1+D2. Ship this framework first, verify for two weeks, then evaluate the follow-ups.

---

## 12. TL;DR for Antigravity

> Home-dashboard is a Next.js 16 / NextAuth v5 beta app with Prisma adapter. Its three Authentik OIDC providers (`authentik-pco`, `authentik-ms`, `authentik-cc`) are already bound to the shared `mtcd_person` scope in Authentik (verified 2026-07-25). The app just ignores those claims. This ship (Phase D1+D2 for home-dashboard, following the announcements portal pattern):
>
> 1. Add `mtcdPersonId` (unique, nullable), `mtcdIdentitySource`, `mtcdLastSyncedAt` columns to `User` in `prisma/schema.prisma` + migration.
> 2. Add matching NextAuth type augmentations to `src/types/next-auth.d.ts` (also fixing the duplicate `NextAuth` import bug at the top of that file).
> 3. Create `src/lib/iam.ts` with `classifyProvider`, `extractPidClaims`, `findExistingUserByIam` (3-tier: pid → pid history → email).
> 4. Rewrite the `signIn` callback in `src/auth.ts` to use `findExistingUserByIam` for Authentik providers, dual-write pid, and preserve every existing behavior (msName/pcoName/ccName upsert, groups→isAdmin, pushToNewUsers auto-assign, activity log).
> 5. Propagate `mtcdPersonId` and `mtcdIdentitySource` through `jwt` and `session` callbacks.
> 6. Add `scripts/backfill-mtcd-person-ids.ts` that fetches `https://admin.server.mtcd.org/iam/api/export/users`, matches by email, dry-run by default, CSV report.
> 7. Extend admin UI (`src/app/admin/users/UserBoard.tsx`) with an "IAM Link" column, "Unlinked users" filter, manual link/unlink actions, and Sync-from-IAM buttons.
> 8. Add tests in `src/lib/iam.test.ts` covering all three matching tiers + non-Authentik pass-through cases.
> 9. Bump version to `1.9.0`, ship to Stack 58 (`home.server.mtcd.org`) only. Stack 59 (Abraham/Synology) runs the same image but has no Authentik env vars set, so all pid logic no-ops there.
>
> Zero changes to other repos. Zero new Authentik objects. Zero compat_mode flips. Zero new environment variables. Additive Prisma migration only.
>
> Do NOT deploy Sunday morning (07:00–13:59 local); any other time is safe. Do NOT touch Stack 59.
