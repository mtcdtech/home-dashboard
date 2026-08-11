# Change Tracker: Home Dashboard

## Running Change Log

### 2026-08-11 - CI/CD Pipeline Rewrite (deploy.yml, no version bump)
- **Summary**: Rewrote `.github/workflows/deploy.yml` to fix chronic silent build hangs. Root cause was a single-runner multi-arch buildx step (`linux/amd64,linux/arm64`) that used QEMU emulation for arm64 and would stall 30-90 minutes on registry cache round-trips with no timeout, no fail-fast, and no post-deploy verification. Silent hangs meant the live site would stay on the old version for hours or days with no signal.
- **New pipeline shape**:
  - `build-amd64` job on native `ubuntu-latest` (x64) — no QEMU
  - `build-arm64` job on native `ubuntu-24.04-arm` (free for public repos)
  - `manifest` job combines both per-arch images into multi-arch manifests for `:${sha}`, `:v${version}`, `:latest`
  - `deploy` job runs `update_portainer.py` (self-gates by branch: `main` → MTCD, `abraham-prod` → Abraham), then **polls the live login page for the expected version**; workflow FAILS after 10 min of mismatch instead of silently succeeding.
  - Concurrency group per branch: superseded pushes auto-cancel.
  - Timeouts: 25 min per build job, 15 min on deploy job, 10 min on manifest job.
- **Result**: First run on the new pipeline (SHA 1d40178) completed in ~8 minutes end-to-end on both branches; previously-hung v1.11.0 build (previous SHA d7360e3) had been in_progress for 2+ hours. Both `home.server.mtcd.org` and `home.abraham16.com` now serve v1.11.0.
- **abraham-prod branch**: fast-forwarded from stale 41587d4 (July 22, v1.8.0) to 1d40178 (v1.11.0 + new deploy). No commits lost (ahead=0, behind=17 before ff).
- **Files modified**:
  - [.github/workflows/deploy.yml](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/.github/workflows/deploy.yml) — full rewrite
- **Deploy contract (canonical, going forward)**:
  - Any push to `main` deploys to Church Synology (home.server.mtcd.org)
  - Any push to `abraham-prod` deploys to Abraham Mac Mini (home.abraham16.com)
  - Both build the SAME multi-arch image tagged by SHA — arch mismatches at runtime are impossible
  - If the live footer version doesn't match `package.json` within 10 min post-deploy, the workflow FAILS red — no more silent v-mismatches
- **Fork status**: `benny2168/home-dashboard` (has no CI, never actually deployed anything) marked for archive. Abraham deploys exclusively via `mtcdtech/home-dashboard abraham-prod` branch now.

### 2026-07-25 - IAM Spec API & Key Manager UI Modal (v1.9.0)
- **Summary**: Implemented exact IAM portal roles specification (`GET /api/iam/roles`) returning `{ roles: [{ id: "admin", name: "Administrator", description: "..." }, ...] }`. Created DB-backed API key management in `GlobalSettings.iamApiKey`, and added an IAM Portal API section in the **Admin & IAM Settings** modal (`UserBoard.tsx`) exposing the Roles API URL, API Key viewer/copy controls, and a **Regenerate Key** button.
- **Files Created/Modified**:
  - [prisma/schema.prisma](file:///Users/benny2168/Antigravity/home-dashboard/prisma/schema.prisma) (added `iamApiKey` to `GlobalSettings`)
  - [prisma/migrations/20260725000000_iam_integration_add_mtcd_person_id/migration.sql](file:///Users/benny2168/Antigravity/home-dashboard/prisma/migrations/20260725000000_iam_integration_add_mtcd_person_id/migration.sql) (added `iamApiKey` column addition)
  - [src/lib/iam.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/iam.ts) (added `getIamApiKey` and `validateIamApiKey` helpers)
  - [src/app/api/iam/roles/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/roles/route.ts) (returns exact spec shape)
  - [src/app/api/iam/users/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/users/route.ts) (uses `validateIamApiKey`)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `getIamApiDetails` and `regenerateIamApiKey` server actions)
  - [src/app/admin/users/UserBoard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/users/UserBoard.tsx) (IAM API URL display, API Key visibility toggle, copy buttons, and Regenerate Key button in Modal)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npx prisma generate` generated updated client.
  - `npm run build` compiled `/api/iam/roles` and `/api/iam/users` successfully.

### 2026-08-02 - Authentik Login Integration & Simplified Roles (v1.10.0)
- **Summary**: Implemented Authentik SSO login button rename to "Log in Securely". Simplified the exposed user roles schema to just `admin` and `standard`. Mapped Authentik group `app_homedashboard_admin` to grant admin rights in NextAuth `signIn` callback. Disabled webapp local admin edits and made user management view read-only with a notice redirecting admin role changes to the MTCD Admin Portal. Completed one-time reverse pull of active webapp admins to the Admin Portal and Authentik groups.
- **Files Created/Modified**:
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to 1.10.0)
  - [src/app/login/LoginForm.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/login/LoginForm.tsx) (SSO button renamed)
  - [src/app/api/iam/roles/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/roles/route.ts) (roles reduced to `admin` / `standard`)
  - [src/app/api/iam/users/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/users/route.ts) (user role mapping and version update)
  - [src/auth.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/auth.ts) (mapped Authentik group to `isAdmin`)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (disabled toggleUserAdmin)
  - [src/app/admin/users/UserBoard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/users/UserBoard.tsx) (static admin badge and warning note added)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - Executed Portainer Exec sync script inside `admin-portal` container to perform reverse pull sync.
  - Run Next.js build compilation locally with `DATABASE_URL` check. Build compiled successfully.

### 2026-08-11 - Performance Optimization Runbook (v1.11.0)
- **Summary**: Implemented end-to-end performance optimizations from `perf-runbook.md`. Enabled SSR HTML rendering on Dashboard component, un-blocked TTFB by converting avatarColor database updates to async background tasks, slimmed Prisma group/department queries with distinct filtering, and integrated `@next/bundle-analyzer`.
- **Files Created/Modified**:
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/components/Dashboard.tsx) (removed SSR-killer `if (!mounted) return null` gate and gated theme toggle icon)
  - [src/app/page.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/page.tsx) (converted `prisma.user.update` for `avatarColor` to fire-and-forget `.catch(...)`)
  - [src/app/admin/sync/page.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/sync/page.tsx) (slimmed Prisma `dashboardGroup` query with `distinct` and `where: { not: null }`)
  - [next.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/next.config.ts) (wrapped config with `@next/bundle-analyzer`)
  - [.gitignore](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/.gitignore) (added `perf-reports/`)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.11.0` and added `@next/bundle-analyzer` devDependency)
  - [perf-reports/bundle-2026-08-11.html](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/perf-reports/bundle-2026-08-11.html) (saved client bundle analyzer report)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
- **Validation**:
  - `ANALYZE=true npx next build --webpack` completed successfully.
  - Generated client bundle analysis report at `perf-reports/bundle-2026-08-11.html`.


