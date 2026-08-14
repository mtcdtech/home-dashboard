# Home Dashboard MTCD — Performance Runbook

**Owner:** Ben
**Repo:** `home-dashboard-mtcd` (`mtcdtech/home-dashboard`)
**Test mode:** DEPLOY-FIRST. NextAuth OIDC (Authentik), Postgres, Portainer Stack 58 — real integrations only work in prod. Local `npm run build` runs as a sanity gate.
**Baseline version:** `v1.10.0` → target `v1.11.0`.
**Sibling reference:** the identical fix already shipped successfully on `home-dashboard-abraham` v1.10.0 (see that repo's `change-tracker.md` for the exact commit pattern used). This runbook applies the same 4 fixes here.

---

## Scope

1. **Remove `if (!mounted) return null`** in `src/components/Dashboard.tsx` (line ~702).
2. **Un-await the `user.update` avatarColor write** in `src/app/page.tsx`.
3. **Slim the department query** in `src/app/page.tsx` (add `distinct: ['department']` + `where: { department: { not: null } }`).
4. **Add `@next/bundle-analyzer`** + save report to `perf-reports/bundle-YYYY-MM-DD.html`.

## Non-goals (DO NOT touch this pass)

- Do NOT flip `force-dynamic` off. Per-user permissions + impersonation + public tabs make caching non-trivial.
- Do NOT rewrite the permission filter into a Prisma `where` clause. mtcd has `resolveTabAccess`/`resolveSectionAccess` in `src/lib/permissions.ts` — a real refactor, separate runbook.
- Do NOT convert `LucideIcons` wildcard imports. Icons are dynamically looked up by DB-stored string — a named-import rewrite would break every user-configured icon.
- Do NOT lazy-load `ThemeModal` / `TabModal` yet. Wait for bundle numbers.
- Do NOT touch `src/auth.ts`, `src/lib/permissions.ts`, `src/lib/iam.ts`, `src/lib/iam-backfill.ts`, or anything under `src/app/api/iam/`, `src/app/api/sync/`, or `src/app/api/track/`.
- Do NOT touch the impersonation cookie logic in `page.tsx` — keep the `cookies()` block, `impersonateUserId` resolution, and the `dbUser = target as any` reassignment intact.
- Do NOT touch the public-view branch (`isPublicView`, `requestedTab`, `isPublic: true` query).

## Pre-flight

1. Working tree check: `package-lock.json` may be dirty — if so, `git checkout -- package-lock.json` to start clean.
2. Confirm `git status` clean, on `main`, up to date with `origin/main`.
3. No stash needed (unlike abraham, mtcd has no WIP to protect).

## The fixes

### Fix 1 — remove SSR-killer gate

**File:** `src/components/Dashboard.tsx` (line ~702)

Delete this line:

```tsx
if (!mounted) return null;
```

Keep the `useMounted()` hook and `const mounted = useMounted()` — other code may still reference `mounted`. Search for other `mounted` uses. If any conditional rendering depends on `mounted` for hydration mismatch avoidance on **specific elements**, gate ONLY those with `mounted && (...)`. Do not gate the whole component.

Common hydration-warning culprits after this change:
- `useTheme()` from `next-themes` → already handled by `suppressHydrationWarning` on `<html>` in `layout.tsx` (verify).
- `Date.now()` / `Math.random()` / `window.*` / `localStorage` in render → move to `useEffect`.

Do NOT re-add the whole-component gate to "fix" a warning. Find the specific culprit.

### Fix 2 — un-await avatarColor write

**File:** `src/app/page.tsx`

Current:
```tsx
if (dbUser && !dbUser.avatarColor) {
   const colors = [...];
   const randomColor = colors[Math.floor(Math.random() * colors.length)];
   await prisma.user.update({
      where: { id: userId },
      data: { avatarColor: randomColor }
   });
   dbUser.avatarColor = randomColor;
}
```

Change to:
```tsx
if (dbUser && !dbUser.avatarColor) {
   const colors = [...];
   const randomColor = colors[Math.floor(Math.random() * colors.length)];
   dbUser.avatarColor = randomColor;
   // Fire-and-forget: don't block TTFB on this cosmetic write.
   prisma.user.update({
      where: { id: userId },
      data: { avatarColor: randomColor }
   }).catch((err) => console.error("avatarColor write failed:", err));
}
```

### Fix 3 — slim department query

**File:** `src/app/page.tsx`

Replace:
```tsx
prisma.user.findMany({ select: { department: true } })
```
With:
```tsx
prisma.user.findMany({
  select: { department: true },
  distinct: ['department'],
  where: { department: { not: null } },
})
```

If mtcd uses this same pattern in multiple places (e.g. for `allDepartments` AND for admin views), apply the same treatment only to instances that are ONLY consumed for their distinct department set. Do NOT change queries that need per-user rows.

Do NOT modify the outer permission `.filter()` logic. Do NOT modify `resolveTabAccess`/`resolveSectionAccess` calls.

### Fix 4 — add bundle analyzer

Install:
```bash
npm install --save-dev @next/bundle-analyzer
```

Wrap `next.config.js` / `.mjs` / `.ts` (check which):
```js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
```

Run once:
```bash
ANALYZE=true npm run build
```

Save client HTML report to `perf-reports/bundle-YYYY-MM-DD.html`. Add `perf-reports/` to `.gitignore`.

## Version bump + memory files

1. Bump `package.json` version: `1.10.0 → 1.11.0`. Update footer version constants in `src/app/login/LoginForm.tsx` AND `src/components/Dashboard.tsx` (both hardcode the version string in this codebase — verify with `grep -rn v1.10.0 src/`).
2. Update `change-tracker.md` with dated entry for all 4 fixes.
3. Update `current-state.md`: bump version to v1.11.0, note SSR is now enabled (mounted-gate removed) and avatarColor write is async.
4. Update `notes-next-session.md` with the same follow-ups the abraham repo has: (a) curated Lucide icon allow-list, (b) lazy-load `ThemeModal`/`TabModal` via `next/dynamic`, (c) push permission filter into Prisma `where`, (d) evaluate `unstable_cache` for tab tree.

## Acceptance tests

1. `npm run build` completes with no new errors.
2. `npm run lint` (if configured) passes.
3. Boot locally (`npm start`), curl `/` — body should contain SSR-rendered dashboard HTML (not empty `<body>`).
4. Log in via Authentik and verify: (a) icons still render, (b) impersonation still works (`?impersonate=<userId>` cookie flow), (c) public tab access via `?tab=<publicTabId>` still works when signed out.
5. Bundle analyzer report saved and top-5 chunks noted.

## Deploy sequence

1. Commit each logical fix as its own commit with change-tracker convention.
2. Push to `origin/main`.
3. Portainer Stack 58 pulls and redeploys automatically.
4. Poll footer for v1.11.0 confirmation — LoginForm renders the version string as a `<span>`, so:
```bash
curl -sL -m 8 https://home.server.mtcd.org/login | grep -oE 'v1\.[0-9]+\.[0-9]+' | sort -u
```
Print confirmed live version to summary output. Done = `v1.11.0` returned.

## Rollback

Each fix is isolated. If prod breaks: `git revert <sha> && git push`. Portainer redeploys reverted image.

If Fix 1 causes hydration blowups: hotfix commit re-adding `if (!mounted) return null` while we diagnose. Don't leave prod broken.

## Safety fences

- Do NOT `git push --force`.
- Do NOT touch `src/auth.ts`, `src/lib/permissions.ts`, `src/lib/iam.ts`, `src/lib/iam-backfill.ts`.
- Do NOT touch `src/app/api/iam/*`, `src/app/api/sync/*`, `src/app/api/track/*`.
- Do NOT delete `Dashboard.tsx.bak`.
- Do NOT touch impersonation or public-view branches in `page.tsx` beyond Fix 2 & 3.
- Do NOT modify Prisma schema.

## If anything is ambiguous

Stop. Print a `QUESTION:` line and wait. Do not guess.
