# Current State: Home Dashboard

## Project Architecture & Context
- **Repository**: [mtcdtech/home-dashboard](https://github.com/mtcdtech/home-dashboard)
- **Active Branch**: `main`
- **Tech Stack**: Next.js 16 (App Router), React 19, Prisma (PostgreSQL), NextAuth v5, Tailwind CSS / Vanilla CSS, Docker / Portainer.
- **Current Version**: `v1.12.1` (Self-Hosted Icon Route URL Fix & Path Migration Script)
- **Deployment Strategy**: Push to GitHub `main` branch triggers Docker build & Portainer stack redeployment for Church Synology (`home.server.mtcd.org`). Push to `abraham-prod` branch triggers build & Portainer container redeployment for Abraham Mac Mini (`home.abraham16.com`).

## Status & Operational State
- **Self-Hosted Icon Route URL Fix & Path Rewriter (v1.12.1)**:
  - Updated `downloadIconToDisk` and `saveBase64IconToDisk` in `src/lib/icon-storage.ts` to return `/api/uploads/icons/<hash>.<ext>` instead of `/uploads/icons/...` (files are still saved on disk at `/app/public/uploads/icons/<hash>.<ext>`). Next.js serves post-build uploaded files via `/api/uploads/[...path]/route.ts`.
  - Extended `encodeMediaToBase64` in `src/app/api/sync/workspace/route.ts` to check both `/uploads/` and `/api/uploads/` local path prefixes.
  - Updated `isExternalUrl` and `downloadIconToDisk` in `scripts/migrate-icons-to-disk.mjs` to match and skip `/api/uploads/` paths for idempotency.
  - Created `scripts/fix-icon-paths.mjs` ESM migration script with `--dry-run` default, `--apply` flag, and automated PostgreSQL table backups (`pg_dump` with Prisma JSON fallback) to rewrite existing `/uploads/icons/%` paths in `Bookmark`, `Section`, `Tab`, and `Theme` to `/api/uploads/icons/%`.
- **Portainer & Workspace Sync Fetch Timeout Hardening (v1.11.2)**:
  - Added 5-second fetch timeouts (`AbortSignal.timeout(5000)`) to `refreshSyncedWorkspace` and all outbound `fetch` calls in `fetchPortainerContainers`.
  - Caught `AbortError` / `TimeoutError` exceptions cleanly, returning error objects instead of throwing, and logged WARN messages specifying target URL and elapsed duration.
  - Hardened `PortainerWidget` to display a 5s timeout indicator during container loading and render an inline error card with a retry button on fetch failure/timeout.
- **Abraham Container Env Preservation & Authentik Migration (v1.11.1)**:
  - Rewrote `deploy_abraham_container()` in `update_portainer.py` to inspect `dashboard-app` before stopping/removing it.
  - Carries forward existing env variables, `HostConfig` (binds/ports), and `NetworkingConfig` across redeployments.
  - Removed hardcoded `SYNOLOGY_*` credentials from Python script so secrets managed in Portainer survive CI deploys.
- **Performance Optimization (v1.11.0)**:
  - Enabled SSR rendering on Dashboard component by removing the mounted-gate (`if (!mounted) return null`).
  - Made cosmetic `user.update` for `avatarColor` in `page.tsx` async (fire-and-forget `.catch(...)`) to eliminate TTFB delays.
  - Slimmed Prisma queries for `dashboardGroup` in `admin/sync/page.tsx` using `distinct: ['dashboardGroup']` and `where: { dashboardGroup: { not: null } }`.
  - Configured `@next/bundle-analyzer` in `next.config.ts` and generated bundle report (`perf-reports/bundle-2026-08-11.html`).
- **IAM Integration (Phase D1+D2)**: Completed.
  - Added `mtcdPersonId`, `mtcdIdentitySource`, `mtcdLastSyncedAt` columns & unique index to `User` model.
  - NextAuth type augmentation in `src/types/next-auth.d.ts`.
  - Implemented `src/lib/iam.ts` helper module providing `classifyProvider`, `extractPidClaims`, and 3-tier user lookup (`findExistingUserByIam`).
  - Rewrote `signIn` callback in `src/auth.ts` to perform 3-tier user resolution (Tier 1: `mtcdPersonId`, Tier 2: `mtcd_person_id_history`, Tier 3: `email`), saving `mtcdPersonId`, `mtcdIdentitySource`, and `mtcdLastSyncedAt` on every Authentik login.
  - Created IAM backfill script `scripts/backfill-mtcd-person-ids.ts` & `src/lib/iam-backfill.ts`. Added `backfill:iam` / `backfill:iam:apply` scripts to `package.json`.
  - Added IAM Server Actions (`iamBackfillDryRun`, `iamBackfillApply`, `iamManualLink`, `iamUnlink`, `getIamApiDetails`, `regenerateIamApiKey`) in `src/app/admin/actions.ts`.
  - Updated Admin User Board (`UserBoard.tsx`) with IAM Link status column, "Unlinked from IAM" filter chip, manual link/unlink modal tools, and dry-run/apply backfill triggers.
- **Authentik SSO & Roles Integration (v1.10.0)**:
  - Simplified the Roles API (`/api/iam/roles`) and User API role mapping (`/api/iam/users`) to return only `admin` and `standard` roles.
  - Updated `src/auth.ts` to map OIDC group `app_homedashboard_admin` (along with legacy fallback groups) to `isAdmin: true` for Authentik sign-ins.
  - Renamed the login screen SSO button text to "Log in Securely".
  - Made the Admin role toggling read-only in the webapp: blocked state modification in `toggleUserAdmin` (throws error) and replaced the interactive admin toggle buttons with static tags on the Admin `/admin/users` page.
  - Added a warning notice in the Admin `/admin/users` view linking to the MTCD Admin Portal for administrator role modifications.
  - Completed one-time reverse pull sync of dashboard administrators (`avcoordinator@mtcd.org`, `tech@mtcd.org` / `ben@abraham16.com`, and `webmaster@mtcd.org`) to the MTCD Admin Portal (`webapps.json`) and Authentik groups.

## Environment Requirements
- `DATABASE_URL`: PostgreSQL connection string (see `.env.example`).
- `AUTH_SECRET`: NextAuth secret key.
- `IAM_API_KEY`: Fallback API key for IAM portal access to `/api/iam/roles` and `/api/iam/users` (also managed dynamically in DB).
- `PORTAINER_URL` & `PORTAINER_API_KEY`: For container monitoring integration.
- `IAM_EXPORT_URL`: Optional override for IAM export API (defaults to `https://admin.server.mtcd.org/iam/api/export/users`).

## Known Risks & Considerations
- Deploying to production Stack 58 (`home.server.mtcd.org`) runs the additive Prisma migration automatically.
- Abraham Mac Mini (`home.abraham16.com`) container env is preserved across redeploys. Ready for manual Authentik OIDC credential addition in Portainer.

