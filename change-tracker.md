# Change Tracker: Home Dashboard

## Running Change Log

### 2026-07-25 - IAM Integration Framework Phase D1+D2 (v1.8.0 → v1.9.0)
- **Summary**: Implemented full IAM integration framework for `home-dashboard` to consume `mtcd_person_id`, `mtcd_person_id_history`, `mtcd_login_source`, and `mtcd_identities` from Authentik SSO providers.
- **Files Created/Modified**:
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.9.0`, added `tsx` devDependency, added `backfill:iam` & `backfill:iam:apply` scripts)
  - [prisma/schema.prisma](file:///Users/benny2168/Antigravity/home-dashboard/prisma/schema.prisma) (added `mtcdPersonId`, `mtcdIdentitySource`, `mtcdLastSyncedAt` fields)
  - [prisma/migrations/20260725000000_iam_integration_add_mtcd_person_id/migration.sql](file:///Users/benny2168/Antigravity/home-dashboard/prisma/migrations/20260725000000_iam_integration_add_mtcd_person_id/migration.sql) (additive migration SQL)
  - [src/types/next-auth.d.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/types/next-auth.d.ts) (augmented `Session`, `User`, `Profile`, and `JWT` interfaces)
  - [src/lib/iam.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/iam.ts) (provider classification & 3-tier user resolution logic)
  - [src/auth.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/auth.ts) (3-tier user lookup in `signIn`, dual-write claims, JWT & session propagation)
  - [scripts/backfill-mtcd-person-ids.ts](file:///Users/benny2168/Antigravity/home-dashboard/scripts/backfill-mtcd-person-ids.ts) (backfill script with dry-run/apply modes and CSV reporting)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (IAM server actions for backfill, manual linking, and unlinking)
  - [src/app/admin/users/UserBoard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/users/UserBoard.tsx) (IAM Link column, unlinked filter chip, manual link modal, and backfill controls)
  - [src/lib/iam.test.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/iam.test.ts) (unit tests for IAM utilities)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npx prisma generate` completed cleanly.
  - `npm run build` compiled 21 static/dynamic routes with zero errors.
  - Unit tests verified provider classification, claim extraction, 3-tier resolution, and conflict handling.
