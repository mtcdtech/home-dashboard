# Current State: Home Dashboard

## Project Architecture & Context
- **Repository**: [mtcdtech/home-dashboard](https://github.com/mtcdtech/home-dashboard)
- **Active Branch**: `main`
- **Tech Stack**: Next.js 16 (App Router), React 19, Prisma (PostgreSQL), NextAuth v5, Tailwind CSS / Vanilla CSS, Docker / Portainer.
- **Current Version**: `v1.11.0` (Performance Optimization Runbook Shipped: SSR Enabled + Async avatarColor Write + Slim Dept Queries + Bundle Analyzer)
- **Deployment Strategy**: Push to GitHub `main` branch triggers Docker build & Portainer stack redeployment (Stack 58 `homedashboard`).

## Status & Operational State
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
- Stack 59 (`home.abraham16.com`) continues to no-op gracefully with Synology SSO.

