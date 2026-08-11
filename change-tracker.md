# Change Tracker: Home Dashboard

## Running Change Log

### 2026-08-11 - Self-Hosted Icons & Storage Infrastructure (v1.12.0)
- **Summary**: Implemented self-hosted icon storage across the application to eliminate external CDN dependencies (Brandfetch expiration, jsDelivr slowdowns). Created `src/lib/icon-storage.ts` with `downloadIconToDisk` (5s timeout, 2MB max, content-type + magic-byte sniffing, SVG sanitization), `saveBase64IconToDisk`, `isExternalUrl`, and `isLucideIconName`. Updated `IconPicker.tsx` to route external icon URLs through a new server action `downloadAndStoreIcon` in `src/app/admin/actions.ts` emitting `/uploads/icons/<hash>.<ext>` paths while preserving search UX and gracefully handling errors. Updated `refreshSyncedWorkspace` and `processMediaField` to store local icons and updated `src/app/api/sync/workspace/route.ts` `encodeMediaToBase64` to inline external URLs as base64 data URIs. Created idempotent migration script `scripts/migrate-icons-to-disk.mjs` with `--dry-run` default, `--apply` flag, and automated PostgreSQL table backups (`pg_dump` with Prisma JSON fallback).
- **Files Modified**:
  - [src/lib/icon-storage.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/icon-storage.ts) (created helper module)
  - [src/components/IconPicker.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/components/IconPicker.tsx) (routed external URLs through server action and emitted local paths)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (added `downloadAndStoreIcon` server action and updated `processMediaField`)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (extended `encodeMediaToBase64` for external URLs)
  - [scripts/migrate-icons-to-disk.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/migrate-icons-to-disk.mjs) (created icon migration ESM script)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.12.0`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Ran `npm run build` locally — compiled successfully in 21s with 0 errors.
  - Verified ESM migration script loads cleanly with `node scripts/migrate-icons-to-disk.mjs`.

### 2026-08-11 - Portainer & Workspace Sync Fetch Timeout Hardening (v1.11.2)
- **Summary**: Implemented defensive 5-second fetch timeouts (`AbortSignal.timeout(5000)`) and non-blocking error handling across all outbound server action fetches in `refreshSyncedWorkspace` and `fetchPortainerContainers`. Caught `AbortError` / `TimeoutError` exceptions cleanly, returning error objects instead of throwing, and added WARN log output specifying the target URL and elapsed duration. Updated `PortainerWidget` loading state to display a timeout indicator (`(5s timeout)`) and render an inline error card with a retry button when container fetches fail or time out.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (added `signal: AbortSignal.timeout(5000)`, WARN logging with target URL and elapsed time, and clean non-throwing error handling to `refreshSyncedWorkspace` and all `fetch` calls in `fetchPortainerContainers`)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/components/widgets/PortainerWidget.tsx) (added 5s timeout indicator to loading text and rendered inline error card with retry button on error)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.11.2`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Ran local `npm run build` compilation to verify complete type safety.
  - Verified Synology SSO button auto-hides via existing env gate (`hasSynology={!!process.env.SYNOLOGY_CLIENT_ID}`).

### 2026-08-11 - Abraham Container Env-Preservation Fix & Authentik Migration Path (v1.11.1)
- **Summary**: Rewrote `deploy_abraham_container()` in `update_portainer.py` to inspect the running `dashboard-app` container (`GET /api/endpoints/3/docker/containers/dashboard-app/json`) before recreating it. Preserves existing environment variables, `HostConfig` (port bindings & directory mounts), and `NetworkingConfig` across container redeployments instead of hardcoding static `SYNOLOGY_*` credentials and wiping container env state. Added minimal default env fallbacks for first-time deploys, ensured `REDEPLOY_DATE` is always updated to trigger image pull/restart, and removed hardcoded Synology credentials from deploy script to support transition to Authentik SSO (`https://auth.abraham16.com`).
- **Files Modified**:
  - [update_portainer.py](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/update_portainer.py) (rewrote `deploy_abraham_container()` to read container inspect config before recreate, parse existing `Env`, preserve `HostConfig`/`NetworkingConfig`, and inject missing minimal defaults)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.11.1`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Tested container inspection against Portainer endpoint 3 API (`GET /api/endpoints/3/docker/containers/dashboard-app/json`). Verified complete parsing of existing env dict, `HostConfig` (Binds, PortBindings), and `NetworkSettings.Networks`.
  - Confirmed image tag logic and "stop → remove → create → start" sequence preserved.

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


