# Change Tracker: Home Dashboard

## Running Change Log

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
