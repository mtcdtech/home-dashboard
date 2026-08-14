# Notes for Next Session: Home Dashboard

## Deploy Contract (canonical, as of 2026-08-11)
- **Both servers are deployed from `mtcdtech/home-dashboard`.** There is no active abraham fork.
  - Push to `main` → deploys to Church Synology (`https://home.server.mtcd.org`)
  - Push to `abraham-prod` → deploys to Abraham Mac Mini (`https://home.abraham16.com`)
  - To deploy to BOTH: push to `main`, then `git push origin main:abraham-prod`
- **Multi-arch is safe.** Every push builds native amd64 + arm64 in parallel and combines them into a single manifest tagged by SHA / version / `latest`. Portainer pulls the SHA-tagged image, so arch mismatches at runtime are impossible.
- **Silent hangs are dead.** Build jobs have `timeout-minutes: 25`, deploy has 15, and the deploy job POLLS the live login page for 10 minutes checking that the footer version matches `package.json`. If it doesn't match, the workflow fails red — no more "shipped to git but still on old version" surprises.
- **`benny2168/home-dashboard` is a dead fork.** It has no CI and never actually deployed anything to any live site. Slated for archive on GitHub (needs Ben's own admin access to complete). Any local work Ben still wants to keep in that clone should be transplanted to a branch of `mtcdtech/home-dashboard`.

## Abraham Container Env-Preservation & Authentik Migration (v1.11.1)
- **Env-Preservation Behavior**: `deploy_abraham_container()` in `update_portainer.py` now inspects `dashboard-app` (`GET /api/endpoints/3/docker/containers/dashboard-app/json`) BEFORE stopping/removing the container. Existing env vars, `HostConfig` (binds/ports), and `NetworkingConfig` are carried forward verbatim. Hardcoded `SYNOLOGY_*` credentials have been removed from Python deploy logic so secrets managed in Portainer survive CI deployments.
- **Manual Portainer Migration Steps for Ben**:
  Log into Abraham Portainer (`https://docker.abraham16.com`) → endpoint 3 (Mac Mini) → Containers → `dashboard-app` → Duplicate/Edit → Environment variables:
  - **Add**:
    - `AUTHENTIK_CLIENT_ID` = `<from Authentik provider>`
    - `AUTHENTIK_CLIENT_SECRET` = `<from Authentik provider>`
    - `AUTHENTIK_ISSUER` = `https://auth.abraham16.com/application/o/dashboard/`
  - **Remove** (only after verifying Authentik login works):
    - `SYNOLOGY_CLIENT_ID`
    - `SYNOLOGY_CLIENT_SECRET`
    - `SYNOLOGY_ISSUER`
  - **Redeploy container**: Login screen will display "Log in with Authentik".
- **Authentik OAuth Callback URL**: Ensure `https://home.abraham16.com/api/auth/callback/authentik` is registered in Authentik provider settings.

## Portainer & Workspace Sync Fetch Timeout Hardening (v1.11.2)
- **Fetch Timeout Protection**: All outbound `fetch` requests in `refreshSyncedWorkspace` and `fetchPortainerContainers` are protected with `signal: AbortSignal.timeout(5000)`.
- **Non-blocking Errors**: Timeouts and connection errors are logged as `WARN` with target URL and elapsed duration in milliseconds, returning clean error objects to the client UI.
- **Portainer Widget Hardening**: `PortainerWidget` displays `(5s timeout)` during container loading and renders an inline error card with a retry button on fetch failure or timeout.

## Self-Hosted Icons Infrastructure & Route Fix (v1.12.1)
- **Code shipped**: Icon storage helpers now return `/api/uploads/icons/<hash>.<ext>` so Next.js runtime route `/api/uploads/[...path]` serves icons uploaded after build. Disk storage location remains `/app/public/uploads/icons/<hash>.<ext>`.
- **Migration CLI commands for Ben to run after deployment**:
  1. Abraham:
     - Dry-run icon path fix: `docker exec dashboard-app node /app/scripts/fix-icon-paths.mjs`
     - Apply icon path fix: `docker exec dashboard-app node /app/scripts/fix-icon-paths.mjs --apply`
     - Dry-run external icon migration (if any external URLs remain): `docker exec dashboard-app node /app/scripts/migrate-icons-to-disk.mjs`
     - Apply external icon migration: `docker exec dashboard-app node /app/scripts/migrate-icons-to-disk.mjs --apply`
  2. MTCD Synology:
     - Dry-run icon path fix: `docker exec homedashboard-app node /app/scripts/fix-icon-paths.mjs`
     - Apply icon path fix: `docker exec homedashboard-app node /app/scripts/fix-icon-paths.mjs --apply`
     - Dry-run external icon migration (if any external URLs remain): `docker exec homedashboard-app node /app/scripts/migrate-icons-to-disk.mjs`
     - Apply external icon migration: `docker exec homedashboard-app node /app/scripts/migrate-icons-to-disk.mjs --apply`
- **Verification**: Run `SELECT count(*) FROM "Bookmark" WHERE icon LIKE '/uploads/%';` against DB — expect 0 rows remaining after `fix-icon-paths.mjs --apply`.

## Recommended Next Steps & Performance Follow-ups
1. **Archive `benny2168/home-dashboard`** on github.com when you get a moment (Settings → General → scroll to Danger Zone → Archive this repository). Local clone at `/Users/benny2168/Antigravity/home-dashboard-abraham` still has uncommitted WIP (entrypoint.sh, LoginForm.tsx, page.tsx) — decide whether to port those to a mtcd branch first.
2. **DNS-Rebinding TOCTOU Network Layer Refactor (I3 Follow-up)**: `src/lib/ssrf.ts` resolves DNS via `isSafeUrl()` before issuing `fetch()`, which leaves a theoretical Time-of-Check to Time-of-Use window if an attacker modifies DNS responses between resolution and HTTP request execution. Full mitigation requires resolving DNS once and connecting directly to the validated IP address with a custom agent setting the `Host` header.
3. **Curated Icon Allow-list for Lucide**: Replace wildcard `LucideIcons` import in `IconPicker.tsx` / `Dashboard.tsx` with a curated allow-list or map to enable tree-shaking for icons.
4. **Modal Lazy Loading**: Lazy-load heavy modals (`ThemeModal`, `TabModal`, `SectionModal`, `BookmarkModal`) using `next/dynamic` to reduce initial client bundle size.
5. **Prisma Permission Filtering**: Push per-user permission filtering into Prisma `where` queries directly rather than filtering in JavaScript post-fetch (`resolveTabAccess`/`resolveSectionAccess`).
6. **Tab Tree Caching**: Evaluate `unstable_cache` or Redis/React cache for tab tree queries if permission model permits.

## Post-Deploy Sanity Checks (do these after any real change)
- Both `https://home.server.mtcd.org/login` and `https://home.abraham16.com/login` footers show the version from `package.json` (v1.13.1).
- Login button says "Log in Securely".
- Log in via Authentik as an administrator (e.g. `tech@mtcd.org`, `ben@abraham16.com`, `avcoordinator@mtcd.org`) and verify admin permissions land correctly.
- Verify PortainerWidget on Abraham home tab displays inline error card or container list within 5 seconds without freezing tab switching.
