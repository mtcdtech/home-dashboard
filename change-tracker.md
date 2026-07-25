# Change Tracker: Home Dashboard

## Running Change Log

### 2026-07-25 - IAM Integration API Endpoints & Refactoring (v1.9.0)
- **Summary**: Exposed `/api/iam/users` and `/api/iam/roles` endpoints protected by `IAM_API_KEY` for the IAM portal to query user roles, `mtcd_person_id` links, and workspace permissions. Refactored backfill code to `src/lib/iam-backfill.ts`.
- **Files Created/Modified**:
  - [src/app/api/iam/users/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/users/route.ts) (User & role export API endpoint)
  - [src/app/api/iam/roles/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/roles/route.ts) (Role definition & mapping API endpoint)
  - [src/auth.config.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/auth.config.ts) (added `/api/iam` to `isPublicApi` middleware exclusions)
  - [src/lib/iam-backfill.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/iam-backfill.ts) (backfill implementation module)
  - [.env.example](file:///Users/benny2168/Antigravity/home-dashboard/.env.example) (added `IAM_API_KEY`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled `/api/iam/users` and `/api/iam/roles` endpoints cleanly.
