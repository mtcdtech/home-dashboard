# Change Tracker: Home Dashboard

## Running Change Log

### 2026-08-31 - Automatic Public Container URL Discovery (v1.14.6)
- **Summary**: Implemented automatic public URL extraction for Portainer container cards. Added `extractPublicUrlFromLabels` in `src/app/admin/actions.ts` to parse container labels, supporting explicit URL labels (`homepage.url`, `homarr.url`, `public_url`, `public.url`, `url`), Nginx `VIRTUAL_HOST` labels, and Traefik `Host(...)` router rules (e.g. `traefik.http.routers.<app>.rule = Host(\`app.domain.com\`)\`). Updated `PortainerWidget.tsx` so clicking a container card automatically uses `c.inferredUrl` (the real public domain) when no custom URL is set, eliminating manual URL configuration.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `extractPublicUrlFromLabels` helper and attached `inferredUrl` to fetched containers)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (used `c.inferredUrl` as default launch URL before port fallback)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.6`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1009ms with 0 errors.

### 2026-08-31 - Portainer Sort Direction, Visibility Sorting & Icon Drop Zone Race Fix (v1.14.5)
- **Summary**: Implemented 3 user enhancements. (1) Added `sortOrder` state (`asc` / `desc`) to `PortainerWidget.tsx` allowing ascending or descending sorting for both Name and Status. (2) Fixed drag-and-drop race condition in `IconPicker.tsx` custom drop zone by adding `e.stopPropagation()` and checking `!e.currentTarget.contains(e.relatedTarget)` so dragging images over drop zone children does not toggle drag state or switch background tabs. (3) Sorted the Container Visibility list in Portainer Widget API Settings modal alphabetically by container name.
- **Files Modified**:
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (added `sortOrder` state/select, updated visible container sort, and sorted visibility list by name)
  - [src/components/IconPicker.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/IconPicker.tsx) (stopped drag event propagation and fixed child element leave checking)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.5`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1135ms with 0 errors.

### 2026-08-31 - Portainer Widget Enhancements & Title Space Key Unblocking (v1.14.4)
- **Summary**: Resolved 3 Portainer widget and input editing requests. (1) Fixed issue where spaces could not be typed into title inputs in modals/widgets by checking `target.tagName` in `handleGridKeyDown` and `handleTabsKeyDown` in `src/components/Dashboard.tsx`. (2) Added status indicator dot badge (`#10b981` running / `#ef4444` stopped) overlaid on container icons in `src/components/widgets/PortainerWidget.tsx` so container state is visible even when custom logos are used. (3) Added `sortBy` setting (`name` | `status`) in Portainer widget settings with option dropdown to sort containers by status (running first) or alphabetically by name.
- **Files Modified**:
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (bypassed input/textarea elements in grid and tab keydown listeners)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (added `sortBy` state, sort logic, status dot indicator badge, and sort dropdown in settings modal)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.4`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 811ms with zero errors.

### 2026-08-29 - Bookmark Duplication Feature (v1.14.3)
- **Summary**: Implemented a bookmark duplication feature. Added a `duplicateBookmark(id)` server action in `src/app/admin/actions.ts` that copies the original bookmark and places it right below it in the same section (shifting subsequent bookmarks up in order). Added a duplicate button (using Lucide `<Copy />` icon) in edit mode next to the delete button on bookmark cards in `src/components/Dashboard.tsx` with proper event propagation blocking (`stopPropagation`).
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (implemented `duplicateBookmark` server action)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (added duplicate button and stopped propagation on click)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.3`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard/package-lock.json) (updated lockfile version)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - Next.js production build (`npm run build`) succeeded.

### 2026-08-29 - Admin Bookmark Saving Permission Bypass Fix (v1.14.2)
- **Summary**: Fixed issue where saving bookmarks failed (the save button did nothing) for global administrators. The root cause was that `requireSectionRole` in `src/lib/authz.ts` lacked an admin bypass, thereby blocking normal admins from modifying bookmarks in sections where they were not explicitly owners/editors. Added admin bypass block following the access-matrix spec. Refined `isLocalAdmin` check to support both `admin@local` and `admin@local.host` emails. Resolved TypeScript and ESLint type lints in `src/lib/authz.ts`.
- **Files Modified**:
  - [src/lib/authz.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/authz.ts) (added admin bypass check to `requireSectionRole`, refined `isLocalAdmin` email validation, and resolved lints)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.2`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard/package-lock.json) (updated lockfile version)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - Next.js production build (`npm run build`) succeeded.
  - ESLint verification (`npx eslint src/lib/authz.ts`) passed cleanly.

### 2026-08-13 - Dependency Security Upgrade & Next.js 16.3.1 (v1.14.1)
- **Summary**: Patched 17 npm vulnerabilities (1 low, 4 moderate, 9 high, 3 critical) including `@auth/core` CVE-2026-7rqj-j65f-68wh, `fast-uri` CVE-2026-2826-b924-f7ph, `undici` CVEs, `hono`, `nanoid`, `valibot`, and bumped `next` from `16.2.2` to `16.3.1` (and `eslint-config-next` to `16.3.1`) to resolve Next.js Server Component DoS / XSS / cache-poisoning advisories (GHSA-q4gf-8mx6-v5v3, GHSA-ffhc-5mcf-pf4q, etc.). Removed deprecated `eslint` option block from `next.config.ts`. Ran full `npm audit` verification bringing vulnerability count from 17 down to 0. Preserved fenced security and auth files (`src/auth.ts`, `src/lib/permissions.ts`, `src/lib/iam.ts`, `api/iam/*`, `entrypoint.sh`).
- **Files Modified**:
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.14.1`, `next` and `eslint-config-next` to `16.3.1`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package-lock.json) (locked dependencies, 0 vulnerabilities remaining)
  - [next.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/next.config.ts) (removed deprecated `eslint` option)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
- **Validation**:
  - `npm audit` returned 0 vulnerabilities (reduced from 17).
  - Next.js production build (`npm run build`) succeeded in Turbopack without warnings/errors.
  - Local smoke test verified `/login` HTTP 200 and rendered footer version `v1.14.1`.

### 2026-08-13 - Password Hashing Migration & Local Admin Hardening (v1.14.0)
- **Summary**: Resolved security audit finding M3 by migrating local administrator credential storage and verification from legacy plaintext to bcrypt hashing (`bcryptjs`, cost factor 12). Added nullable `passwordHash` field to Prisma `User` schema while keeping `password` temporarily for non-disruptive migration. Updated credentials provider in `src/auth.config.ts` to check `bcrypt.compare()` when `passwordHash` is present, falling back to legacy plaintext comparison with automatic silent upgrade (calculating bcrypt hash, storing `passwordHash`, and setting `password` to null on successful login). Removed hardcoded default `"admin"` plaintext password seed fallback, bootstrapping uninitialized admin accounts with a cryptographically secure random password printed once to container logs. Updated `updateLocalAdminSettings` in `src/app/admin/actions.ts` to hash passwords with bcrypt and clear plaintext fields. Created standalone post-deploy database migration script `scripts/migrate-passwords.mjs` to batch-upgrade existing plaintext passwords. Preserved fenced files (`entrypoint.sh` and `src/auth.ts`). Pre-migration Postgres dumps taken on MTCD and Abraham databases.
- **Files Modified**:
  - [prisma/schema.prisma](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/prisma/schema.prisma) (added `passwordHash String?` to User model)
  - [prisma/migrations/20260813213000_add_password_hash/migration.sql](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/prisma/migrations/20260813213000_add_password_hash/migration.sql) (migration SQL for `passwordHash` column)
  - [src/auth.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.config.ts) (added credentials provider with bcrypt verification, silent legacy upgrade, and random admin bootstrap)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (updated `updateLocalAdminSettings` to bcrypt-hash passwords and clear plaintext)
  - [scripts/migrate-passwords.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/migrate-passwords.mjs) (created batch password hashing migration script)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.14.0`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package-lock.json) (synchronized version to `1.14.0`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Validated local Next.js compilation via `npm run build`.
  - Unit tested bcrypt hashing and comparison.
  - Verified non-disruptive silent upgrade logic.
  - Confirmed pre-migration PostgreSQL backups captured on both servers.

### 2026-08-13 - Security Quick Hits & Hardening (v1.13.1)
- **Summary**: Implemented 8 security hardening and audit items across the application. Replaced `Math.random()` with `crypto.randomBytes(32)` for cryptographically secure IAM API key generation (M6). Removed URL query parameter `?api_key=` fallback in IAM roles (`/api/iam/roles`) and users (`/api/iam/users`) routes, requiring `Authorization: Bearer` or `X-API-Key` headers (M7). Replaced direct string comparisons with constant-time `crypto.timingSafeEqual` in `validateIamApiKey` and workspace sync token verification (L2). Bound development PostgreSQL port to loopback interface `127.0.0.1:5434:5432` in `docker-compose.yml` (L3). Added `checks: ["pkce", "state"]` to `MicrosoftEntraID` and `synology` OIDC providers in `src/auth.config.ts` (L4). Created in-memory sliding window rate limiter `src/lib/rate-limit.ts` and applied 60 req/min limit to `/api/track/click` (M8) and 10 req/min limit to POST `/api/auth/[...nextauth]` (L5). Added dangerous protocol filter (`javascript:`, `data:`, `vbscript:`, `file:`) to `parseBookmarksHtml` and sanitized bookmark URLs with `normalizeUrl` in `executeBookmarkImport` (L6). Added DNS-rebinding TOCTOU architectural documentation to `isSafeUrl` in `src/lib/ssrf.ts` (I3). Added explanatory documentation for `allowDangerousEmailAccountLinking` in `src/auth.config.ts` (I1) and documented unused `Session` model under JWT strategy in `prisma/schema.prisma` (I2).
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (used `crypto.randomBytes` for IAM API key generation - M6; normalized URLs during bookmark import - L6)
  - [src/app/api/iam/roles/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/iam/roles/route.ts) (removed `?api_key=` query param fallback - M7)
  - [src/app/api/iam/users/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/iam/users/route.ts) (removed `?api_key=` query param fallback - M7; bumped version to `1.13.1`)
  - [src/lib/iam.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/iam.ts) (timing-safe comparison for IAM API key - L2)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (timing-safe comparison for sync token - L2)
  - [docker-compose.yml](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/docker-compose.yml) (bound Postgres port to 127.0.0.1 - L3)
  - [src/auth.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.config.ts) (added PKCE and state checks to Entra/Synology providers - L4; documented account linking intent - I1)
  - [src/lib/rate-limit.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/rate-limit.ts) (created sliding window rate limiter - L5, M8)
  - [src/app/api/track/click/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/track/click/route.ts) (applied 60 req/min rate limit - M8)
  - [src/app/api/auth/[...nextauth]/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/auth/%5B...nextauth%5D/route.ts) (applied 10 req/min rate limit on POST - L5)
  - [src/lib/bookmark-parser.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/bookmark-parser.ts) (filtered forbidden protocols - L6)
  - [src/lib/ssrf.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/ssrf.ts) (documented DNS rebinding TOCTOU window - I3)
  - [prisma/schema.prisma](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/prisma/schema.prisma) (documented unused Session model - I2)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.13.1`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Verified Next.js build compilation with `npm run build`.
  - Smoke-tested IAM 401 unauthenticated query rejection and track click rate limiter.

### 2026-08-13 - Security Hardening & Vulnerability Remediation (v1.13.0)
- **Summary**: Patched 3 Critical and 8 High findings from the security audit. Gated `getGlobalSettings` behind `requireAdmin` (C1). Added `requireSectionRole` authorization checks to all bookmark server actions `createBookmark`, `updateBookmark`, `deleteBookmark`, and `moveBookmark` (C2). Gated `fetchPortainerContainers` behind `requireAdmin` and added strict host allowlist validation against `ALLOWED_PORTAINER_HOSTS` / `PORTAINER_URL` before transmitting API credentials (C3). Removed unauthenticated development leftover endpoint `src/app/api/debug-tabs/route.ts` (H1). Removed SSRF fallback bypass in `downloadImageFromUrl` (H2). Hardened file upload handling in `src/app/api/upload/route.ts` and `uploadImage` server action with extension allowlists (`png`, `jpg`, `jpeg`, `webp`, `gif`, `ico`), 5MB size limit, magic-byte format validation, and sanitized filenames; added CSP (`default-src 'none'; img-src 'self'; style-src 'unsafe-inline'`) and nosniff headers to `/api/uploads/[...path]` static file server (H3). Fixed `getEffectiveUserId` to restrict impersonation checking to admin users (H5). Enforced self-or-admin authorization in `setUserDefaultTab` (H6). Added `requireAdmin` to `reorderTabs` (H7). Changed `transferTabOwnership` requirement from editor to tab owner (H8). Added SSRF validation via `isSafeUrl()` on cross-server workspace sync URLs in `importWorkspaceFromSyncUrl` and `refreshSyncedWorkspace` (H9). Added path-traversal guard to `encodeMediaToBase64` in `/api/sync/workspace` (H10). Configured global security response headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Content-Security-Policy) and disabled `X-Powered-By` header in `next.config.ts` (M1, L1; note: inline scripts and unsafe-eval are permitted as required by Next.js hydration). Gated `/api/icons` behind session check returning 401 for unauthenticated requests (M2).
- **Files Modified**:
  - [src/app/api/debug-tabs/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/debug-tabs/route.ts) (deleted unsafe debug endpoint - H1)
  - [src/app/api/icons/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/icons/route.ts) (added `requireSession()` guard returning 401 - M2)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (gated `getGlobalSettings` - C1; added authz to bookmark actions - C2; gated & allowlisted `fetchPortainerContainers` - C3; removed fallback in `downloadImageFromUrl` - H2; hardened `uploadImage` - H3; gated `getEffectiveUserId` - H5; enforced self-or-admin in `setUserDefaultTab` - H6; gated `reorderTabs` - H7; required owner in `transferTabOwnership` - H8; validated sync URLs with `isSafeUrl` - H9)
  - [src/lib/image-validation.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/image-validation.ts) (created image magic-byte, extension allowlist, and filename sanitization utilities - H3)
  - [src/app/api/upload/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/upload/route.ts) (hardened extension, 5MB limit, magic-byte sniffing, and sanitized filename - H3)
  - [src/app/api/uploads/[...path]/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/uploads/%5B...path%5D/route.ts) (added CSP and X-Content-Type-Options headers - H3)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (added path traversal resolution guard in base64 media loop - H10)
  - [next.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/next.config.ts) (disabled `poweredByHeader` and added global security headers - M1, L1)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.13.0`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Ran `npm run build` locally to verify Next.js compilation.
  - Verified `next.config.ts` module load.

### 2026-08-11 - Self-Hosted Icon Route URL Fix & Path Rewriter (v1.12.1)
- **Summary**: Fixed issue where stored `/uploads/icons/<hash>.<ext>` paths returned 404 on production because Next.js does not serve post-build files added to `/public/uploads/` directly. Updated `downloadIconToDisk` and `saveBase64IconToDisk` in `src/lib/icon-storage.ts` to return `/api/uploads/icons/<hash>.<ext>` paths, matching the runtime `/api/uploads/[...path]/route.ts` dynamic file server while keeping disk writes at `/app/public/uploads/icons/<hash>.<ext>`. Updated `encodeMediaToBase64` in `src/app/api/sync/workspace/route.ts` to match both `/uploads/` and `/api/uploads/` local paths. Updated `scripts/migrate-icons-to-disk.mjs` to check `/api/uploads/` for idempotency. Created `scripts/fix-icon-paths.mjs` ESM migration script with `--dry-run` default, `--apply` flag, and automated PostgreSQL table backups (`pg_dump` with Prisma JSON fallback) to rewrite existing `/uploads/icons/%` database values to `/api/uploads/icons/%`.
- **Files Modified**:
  - [src/lib/icon-storage.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/icon-storage.ts) (updated returned URL path format to `/api/uploads/icons/<hash>.<ext>`)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (updated `encodeMediaToBase64` to match both `/uploads/` and `/api/uploads/`)
  - [scripts/migrate-icons-to-disk.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/migrate-icons-to-disk.mjs) (updated `isExternalUrl` and `downloadIconToDisk` to skip `/api/uploads/` paths)
  - [scripts/fix-icon-paths.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/fix-icon-paths.mjs) (created path rewriter ESM migration script)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.12.1`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Tested ESM script loading and execution for `fix-icon-paths.mjs` and `migrate-icons-to-disk.mjs`.
  - Verified Next.js build compilation with `npm run build`.

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


