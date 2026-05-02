You are working in this repo:

/Users/benny2168/Dockers/MTCD/docker/antigravity/mtcd-workspaces/homedashboard

Goal:
Harden the Home Dashboard app for security first, then address the highest-impact efficiency issues. Do this in small, reviewable commits. Do not deploy until all validation passes.

Important:
This is a church member-facing dashboard app. Security is higher priority than performance. Fix critical auth, authorization, file access, and SSRF risks before refactoring efficiency.

Essential task order:

1. Create a safety branch and backup
   - Create a new branch:
     `security-efficiency-hardening`
   - Save a pre-work diff/status backup to `/tmp/homedashboard-hardening/`.
   - Do not overwrite uncommitted work without preserving it.

2. Remove hardcoded admin credentials
   Files to inspect:
   - `src/auth.ts`
   - `src/auth.config.ts`

   Requirements:
   - Remove or disable any `admin/admin` credentials provider behavior in production.
   - If a dev-only credentials provider is retained, guard it with an explicit env var like `ENABLE_DEV_CREDENTIALS=true` and `NODE_ENV !== "production"`.
   - Never auto-create a production admin from hardcoded credentials.
   - Add clear error behavior when credentials login is disabled.

3. Rotate/remove committed production secrets
   Files to inspect:
   - `docker-compose.prod.yml`
   - `.env*`
   - repo root config files

   Requirements:
   - Remove committed `AUTH_SECRET` or any real secret values.
   - Replace with `${AUTH_SECRET:?set AUTH_SECRET}` or equivalent environment reference.
   - Add `.env`, `.env.local`, `.env.production`, secrets, tokens, and generated logs to `.gitignore`.
   - Do not commit new secret values.
   - Add a note to `README` or deployment docs saying the old secret must be rotated.

4. Lock down debug and unauthenticated APIs
   Files to inspect:
   - `src/app/api/debug-auth/route.ts`
   - `src/app/api/sync/**`
   - `src/app/api/upload/**`
   - `src/app/api/uploads/[...path]/route.ts`
   - `src/middleware.ts`
   - `src/auth.config.ts`

   Requirements:
   - Delete `/api/debug-auth` or restrict it to master admins only and remove sensitive fields from output.
   - Do not return password hashes/plaintext password fields, full user lists, or ACL dumps.
   - Revisit middleware exemptions. `/api/sync` must not be globally unauthenticated unless protected by a strong per-route token.
   - Any unauthenticated endpoint must be explicitly justified in comments and protected against data leakage.

5. Add centralized server-side authorization guards
   Files to create/update:
   - `src/lib/authz.ts` or similar
   - `src/app/admin/actions.ts`
   - any other server actions/API mutators

   Requirements:
   - Create helpers:
     - `requireSession()`
     - `requireAdmin()`
     - `requireMasterAdmin()` if applicable
     - `requireTabRole(tabId, minimumRole)`
     - `requireSectionRole(sectionId, minimumRole)`
   - Use the existing permissions resolver from `src/lib/permissions.ts` where appropriate.
   - Every admin server action must call an authorization guard before mutating data.
   - `toggleUserAdmin`, user deletion, role changes, department changes, sync/import actions, push rules, tab/section/bookmark mutations, upload deletion, and settings/theme mutations must be guarded.
   - Standard users may only mutate their own allowed resources.
   - Admin-only actions must fail closed.

6. Fix upload path traversal and file serving
   Files to inspect:
   - `src/app/api/uploads/[...path]/route.ts`
   - upload actions/routes

   Requirements:
   - Normalize and resolve requested paths.
   - Ensure resolved path stays inside the intended uploads directory.
   - Reject `..`, absolute paths, encoded traversal, symlinks if unsafe.
   - Require authentication if uploads are not intentionally public.
   - Set safe content-type and cache headers.
   - Never expose `.env`, Prisma files, source files, or arbitrary filesystem paths.

7. Add SSRF protections for sync/import/image download
   Files to inspect:
   - `src/app/admin/actions.ts`
   - functions like `importWorkspaceFromSyncUrl`, `refreshSyncedWorkspace`, `downloadImageFromUrl`
   - favicon/image import helpers

   Requirements:
   - Validate URLs before fetching.
   - Allow only `http` and `https`.
   - Reject localhost, loopback, private IP ranges, link-local, metadata IPs, and internal hostnames.
   - Add request timeout.
   - Add max response size.
   - Validate content-type for images.
   - Do not write fetched content into public webroot unless it passes validation.
   - Consider an allowlist for trusted sync hosts if practical.

8. Fix known admin UI runtime bugs
   Files:
   - `src/app/admin/sections/SectionsClient.tsx`
   - `src/app/admin/tabs/TabsClient.tsx`
   - `src/app/admin/theme/ThemeClient.tsx`

   Requirements:
   - Fix undefined `modifiedSections` / `setModifiedSections`.
   - Fix undefined `isPushedUser`.
   - Fix undefined `setBackgroundColor`.
   - Run TypeScript after fixes and reduce errors where feasible.

9. Propagate pushed/locked metadata to the dashboard client
   Files:
   - `src/app/page.tsx`
   - `src/components/Dashboard.tsx`
   - related tab modal/remove workspace UI

   Requirements:
   - Preserve resolver output metadata for each tab:
     - `pushed`
     - `locked`
     - `source`
     - `inherited`
   - Send needed metadata to the client.
   - Hide or disable “Remove Workspace” for locked pushed workspaces.
   - Keep server-side enforcement in place.

10. Fix highest-impact efficiency issues
   Do this only after the security tasks above.

   Requirements:
   - Narrow `src/app/page.tsx` Prisma queries using `select` and permission-aware filtering.
   - Remove unnecessary `JSON.parse(JSON.stringify(...))` deep clones where possible.
   - Route icon clients through the existing `/api/icons` endpoint instead of directly hitting GitHub/jsDelivr.
   - Make imported workspace refresh manual or queued instead of auto-refreshing on tab switch.
   - Batch reorder writes or convert to fractional ordering if practical.
   - Avoid `import * as LucideIcons`; use named imports or a curated icon map.
   - Remove `import * as actions` from large client modules where practical.
   - Clean tracked scratch logs, pid files, tar files, and backup files from repo root.
   - Fix duplicate/conflicting `react` / `react-dom` dependency declarations.

11. Add tests
   Requirements:
   - Keep `node scratch/permissions.test.mjs` passing.
   - Add tests or scripts for:
     - auth guard behavior
     - locked push removal denial
     - upload path traversal rejection
     - SSRF URL rejection
     - non-admin cannot call admin mutators
   - If no full test framework exists, add deterministic Node scripts under `scratch/` similar to `permissions.test.mjs`.

12. Validation commands
   Run before each commit if possible:

   ```bash
   npx prisma generate
   node scratch/permissions.test.mjs
   npm run build
   npx tsc --noEmit
   ```

   If `tsc` still fails due to pre-existing errors, summarize:
   - number of errors before/after
   - whether this work introduced any new errors
   - remaining highest-priority TS errors

13. Commit strategy
   Use small commits in this order:
   - `Remove hardcoded auth secrets and debug exposure`
   - `Add server-side authorization guards`
   - `Harden uploads and remote fetches`
   - `Fix admin permissions UI runtime errors`
   - `Propagate locked push metadata to dashboard`
   - `Improve dashboard query and icon efficiency`
   - `Clean repo artifacts and dependency metadata`

14. Final summary
   When done, report:
   - commits created
   - files changed
   - security issues fixed
   - efficiency issues fixed
   - validation results
   - remaining risks
   - whether it is safe to deploy