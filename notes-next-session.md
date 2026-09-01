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

## Microsoft Outlook Calendar Widget & Teams Integration (v1.16.3)
- **Widget Shipped**: Full-featured Microsoft Outlook Calendar widget (`widgetType: "outlook-calendar"`).
- **Subscribed Calendars & Multi-Tab Isolation**: Each tab section maintains its own isolated `sectionId` and `widgetConfig` allowing different Microsoft accounts (e.g. personal, work, avteam) to run side-by-side.
- **Settings Token Preservation**: `saveOutlookWidgetSettingsAction` updates filter preferences and date ranges without overwriting OAuth tokens in PostgreSQL.
- **Teams Links in Event Descriptions**: Scans event body HTML/text, `bodyPreview`, and location fields for Teams meeting links.
- **Authentication**:
  - OAuth 2.0 Auth Code flow with offline refresh token support (`src/lib/outlook.ts`, `/api/widgets/outlook/auth`, `/api/widgets/outlook/callback`).
  - Supports Microsoft 365 work/school accounts and personal Outlook accounts.
  - Automatically falls back to environment variables (`MICROSOFT_CLIENT_ID` / `AUTH_MICROSOFT_ENTRA_ID_ID`, `MICROSOFT_CLIENT_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`) or accepts custom credentials configured in the widget settings modal.
- **Features**:
  - Event listings grouped by day with local start/end times, location, subject, and calendar color tags.
  - Configurable date range slider (1 to 30 days ahead, default 7).
  - Live calendar polling and multi-select checklist allowing users to toggle visible calendars.
  - 1-click Microsoft Teams meeting launch with purple `#464EB8` badge for events with Teams links.
  - Added to widget drawer catalog and integrated into global dashboard search.

## Recommended Next Steps & Performance Follow-ups
1. **Archive `benny2168/home-dashboard`** on github.com when you get a moment (Settings → General → scroll to Danger Zone → Archive this repository).
2. **DNS-Rebinding TOCTOU Network Layer Refactor (I3 Follow-up)**: `src/lib/ssrf.ts` resolves DNS via `isSafeUrl()` before issuing `fetch()`. Full mitigation requires resolving DNS once and connecting directly to the validated IP address with a custom agent setting the `Host` header.
3. **Curated Icon Allow-list for Lucide**: Replace wildcard `LucideIcons` import in `IconPicker.tsx` / `Dashboard.tsx` with a curated allow-list or map to enable tree-shaking for icons.
4. **Modal Lazy Loading**: Lazy-load heavy modals (`ThemeModal`, `TabModal`, `SectionModal`, `BookmarkModal`) using `next/dynamic` to reduce initial client bundle size.
5. **Prisma Permission Filtering**: Push per-user permission filtering into Prisma `where` queries directly rather than filtering in JavaScript post-fetch (`resolveTabAccess`/`resolveSectionAccess`).

## Post-Deploy Sanity Checks (do these after any real change)
- Both `https://home.server.mtcd.org/login` and `https://home.abraham16.com/login` footers show the version from `package.json` (v1.17.0).
- In any icon picker, open the **Custom** tab and verify the "Purge Unused" button exists next to "Refresh".
- Open the Dashboard Widget drawer (Catalog), drag or add "Microsoft Outlook Calendar" to any dashboard column.
- Open Widget Settings, connect a Microsoft Outlook / 365 account, configure days ahead (e.g. 7 days), and filter calendars.
- Verify events appear grouped by date, and verify that clicking "Join Teams" on any event containing a Teams link launches the meeting invite directly in a new tab.
