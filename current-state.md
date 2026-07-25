# Current State: Home Dashboard

## Project Architecture & Context
- **Repository**: [mtcdtech/home-dashboard](https://github.com/mtcdtech/home-dashboard)
- **Active Branch**: `main`
- **Tech Stack**: Next.js 16 (App Router), React 19, Prisma (PostgreSQL), NextAuth v5, Tailwind CSS / Vanilla CSS, Docker / Portainer.
- **Current Version**: `v1.9.0` (IAM Phase D1+D2 ship + IAM API Exporter)
- **Deployment Strategy**: Push to GitHub `main` branch triggers Docker build & Portainer stack redeployment (Stack 58 `homedashboard`).

## Status & Operational State
- **IAM Integration (Phase D1+D2)**: Completed.
  - Added `mtcdPersonId`, `mtcdIdentitySource`, `mtcdLastSyncedAt` columns & unique index to `User` model.
  - NextAuth type augmentation in `src/types/next-auth.d.ts`.
  - Implemented `src/lib/iam.ts` helper module providing `classifyProvider`, `extractPidClaims`, and 3-tier user lookup (`findExistingUserByIam`).
  - Rewrote `signIn` callback in `src/auth.ts` to perform 3-tier user resolution (Tier 1: `mtcdPersonId`, Tier 2: `mtcd_person_id_history`, Tier 3: `email`), saving `mtcdPersonId`, `mtcdIdentitySource`, and `mtcdLastSyncedAt` on every Authentik login.
  - Created IAM backfill script `scripts/backfill-mtcd-person-ids.ts` & `src/lib/iam-backfill.ts`. Added `backfill:iam` / `backfill:iam:apply` scripts to `package.json`.
  - Added IAM Server Actions (`iamBackfillDryRun`, `iamBackfillApply`, `iamManualLink`, `iamUnlink`) in `src/app/admin/actions.ts`.
  - Updated Admin User Board (`UserBoard.tsx`) with IAM Link status column, "Unlinked from IAM" filter chip, manual link/unlink modal tools, and dry-run/apply backfill triggers.
- **IAM API Endpoints**: Exposed for IAM Portal integration:
  - `/api/iam/users` — Exports list of users, `mtcd_person_id`, email, roles (`admin`, `editor`, `user`), department, `dashboard_group`, `allowed_tabs`, and `allowed_sections`.
  - `/api/iam/roles` — Exposes role definitions and user role mappings.
  - Protected via `IAM_API_KEY` (passed via `x-api-key` header, `Authorization: Bearer <key>`, or `api_key` query param) or active admin session.

## Environment Requirements
- `DATABASE_URL`: PostgreSQL connection string (see `.env.example`).
- `AUTH_SECRET`: NextAuth secret key.
- `IAM_API_KEY`: API key for IAM portal access to `/api/iam/users` and `/api/iam/roles`.
- `PORTAINER_URL` & `PORTAINER_API_KEY`: For container monitoring integration.
- `IAM_EXPORT_URL`: Optional override for IAM export API (defaults to `https://admin.server.mtcd.org/iam/api/export/users`).

## Known Risks & Considerations
- Deploying to production Stack 58 (`home.server.mtcd.org`) runs the additive Prisma migration automatically.
- Stack 59 (`home.abraham16.com`) continues to no-op gracefully with Synology SSO.
