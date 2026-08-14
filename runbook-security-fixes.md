# Home Dashboard — Security Fixes (Items 2-5)

## Test mode: DEPLOY-FIRST

Every change lands via git → GitHub Actions → both servers. Local pytest/npm build is a sanity check, not the gate.

## Scope — one dispatch, five clusters of changes

This runbook groups four related fixes into a single AG session. All changes live in `src/app/`, `src/lib/`, and `next.config.mjs`. No dependency changes here — that's a separate runbook.

**In scope:**

1. **Kill or gate unsafe endpoints** (from audit H1, M2, C1)
   - Delete `src/app/api/debug-tabs/route.ts` (H1) — dev leftover, no legitimate prod use
   - Wrap `src/app/api/icons/route.ts` (M2) with `await requireSession()` — return 401 if unauthed
   - Add `requireAdmin()` to `getGlobalSettings` in `src/app/admin/actions.ts` around L762 (C1)

2. **Add missing authz to server actions** (from audit C2, C3, H5-H8, H9, H10)
   - `createBookmark`, `updateBookmark`, `deleteBookmark`, `moveBookmark` → `requireSectionRole(sectionId, "edit")` (C2)
   - `fetchPortainerContainers` → `requireAdmin()` + strict URL allowlist against `process.env.ALLOWED_PORTAINER_HOSTS` env (comma-separated list) (C3). If env var is unset, only allow the URL to exactly match `process.env.PORTAINER_URL` — never send `process.env.PORTAINER_API_KEY` to any URL that doesn't match the allowlist.
   - `getEffectiveUserId` → return `impId` only when `session.user.isAdmin === true`, else return real userId (H5)
   - `setUserDefaultTab(userId, tabId)` → if `session.user.id !== userId && !session.user.isAdmin` throw Unauthorized (H6)
   - `reorderTabs(orderedIds)` → add `requireAdmin()` (H7)
   - `transferTabOwnership` → change `requireTabRole(tabId, "edit")` to `requireTabRole(tabId, "owner")` (H8)
   - `importWorkspaceFromSyncUrl` and `refreshSyncedWorkspace` → validate `syncUrl` / `tab.syncSourceUrl` with existing `isSafeUrl()` / `safeFetch()` from `src/lib/ssrf.ts` — refuse if `isSafeUrl` returns false (H9)
   - `src/app/api/sync/workspace/route.ts` base64 media loop → after computing `filePath`, do `const resolved = path.resolve(filePath); if (!resolved.startsWith(path.resolve(baseUploadsDir) + path.sep)) { continue }` (H10)

3. **Fix `downloadImageFromUrl` SSRF bypass** (H2)
   - In `src/app/admin/actions.ts` around L93-124, the `catch (ssrfErr)` block falls back to direct `fetch(url)`. **Remove the fallback entirely.** If `safeFetch` throws, re-throw or return an error. No unvalidated retry.

4. **Harden file upload + serve** (H3)
   - `src/app/api/upload/route.ts`: enforce
     - Extension allowlist: `png`, `jpg`, `jpeg`, `webp`, `gif`, `ico` — reject anything else with 400
     - Max file size: 5 MB (reject with 413 if larger)
     - Magic-byte check for common image formats (use existing `file-type` package if installed, else write a small helper checking first 12 bytes for PNG/JPEG/WEBP/GIF signatures)
     - Sanitize filename to alphanumeric + dashes + dot + ext only
   - Same hardening on `uploadImage` server action in `src/app/admin/actions.ts` around L55-73
   - `src/app/api/uploads/[...path]/route.ts` (or wherever uploads are served): set response headers on uploaded content:
     - `Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'`
     - `X-Content-Type-Options: nosniff`

5. **Security headers globally + hide Next.js banner** (M1, L1)
   - `next.config.mjs`: set `poweredByHeader: false`
   - Add `headers()` function returning for path `/(.*)`:
     - `X-Frame-Options: SAMEORIGIN`
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
     - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'`
     - Note on CSP: `'unsafe-inline'` and `'unsafe-eval'` for scripts are unfortunately required by Next.js's inline hydration script and Turbopack. Document this in the change-tracker as a known limitation; a stricter CSP with nonces is a follow-up project.

## Out of scope (explicitly)

- **M3 password hashing** — bigger change (schema migration + auth code + migration script). Separate runbook.
- **M4 npm audit fix** — separate runbook, needs full smoke test on both servers.
- **M6 CSPRNG for IAM API key** — trivial 1-line change but only affects newly-generated keys; batching with password hashing runbook.
- **M7 API key in query param** — small change, but the IAM key was just rotated (via C1 fix) so this is lower urgency; batching with next hardening pass.
- **M8 click track DoS** — needs rate-limit infra decision; separate runbook.
- **L2-L6 items** — separate runbook.

## Files touched (verify at end)

Expected diff scope:

- `src/app/admin/actions.ts` — many small guard additions
- `src/app/api/debug-tabs/route.ts` — deleted
- `src/app/api/icons/route.ts` — auth guard added
- `src/app/api/upload/route.ts` — hardened
- `src/app/api/uploads/[...path]/route.ts` — response headers added (or wherever the upload serve route is; find via `grep -r 'from \"public/uploads\"' src/`)
- `src/app/api/sync/workspace/route.ts` — path-traversal guard
- `next.config.mjs` — headers + poweredByHeader
- `change-tracker.md` — version bump entry
- footer version literal — bumped

**Do NOT touch:** `src/auth.ts`, `src/lib/permissions.ts`, `src/lib/iam.ts`, `api/iam/*`, `entrypoint.sh`, `docker-compose.yml`, `prisma/schema.prisma`.

## Version bump

Current: 1.12.1 → Target: **1.13.0** (minor bump — security hardening across many endpoints, no user-facing feature change but material behavior change: unauth callers get 401s where they used to get 200s).

Update:

- `change-tracker.md` — new entry at top with today's date, version, and a bullet per fix cluster referencing audit finding IDs (C1, C2, C3, H1, H2, H3, H5-H10, M1, M2, L1)
- Version literal in the footer HTML (wherever `1.12.1` appears in the JSX — grep will find it)
- `package.json` if `version` field is tracked there

## Build & test steps

1. Read all target files first. Print a plan before editing.
2. Make all edits. Do NOT commit yet.
3. Run local build: `npm run build` from `/Users/benny2168/Antigravity/home-dashboard-mtcd`. If build fails, STOP and print error.
4. Local sanity: `node -e "require('./next.config.mjs')"` to check the config module loads.
5. Commit — ONE commit with message:
   ```
   feat(security): v1.13.0 — patch 3 critical + 8 high findings from audit

   - C1: gate getGlobalSettings behind requireAdmin
   - C2: authz on all Bookmark server actions
   - C3: allowlist + admin gate on fetchPortainerContainers
   - H1: remove /api/debug-tabs endpoint
   - H2: remove SSRF-bypass fallback in downloadImageFromUrl
   - H3: mime/magic/size validation on uploads + CSP on served uploads
   - H5: getEffectiveUserId respects admin check
   - H6: setUserDefaultTab enforces self-or-admin
   - H7: reorderTabs requires admin
   - H8: transferTabOwnership requires owner role
   - H9: SSRF validation on cross-server sync URLs
   - H10: path-traversal guard on /api/sync/workspace media loop
   - M1/L1: security headers + poweredByHeader off
   - M2: /api/icons requires session
   ```
6. Push to `main` — this deploys MTCD via GitHub Actions.
7. Poll MTCD deploy: hit `https://home.server.mtcd.org/` and check footer HTML for `v1.13.0`. Retry every 15s for up to 5 min.
8. Push to `abraham-prod` branch (or whatever the abraham deploy trigger is — check `.github/workflows/`). Poll `https://home.abraham16.com/` for `v1.13.0`.
9. Post-deploy smoke tests via curl (each should now return 401 or 404):
   - `curl -sik https://home.abraham16.com/api/debug-tabs` → expect 404
   - `curl -sik https://home.server.mtcd.org/api/debug-tabs` → expect 404
   - `curl -sik https://home.abraham16.com/api/icons` → expect 401
   - `curl -sik https://home.server.mtcd.org/api/icons` → expect 401
   - `curl -sIk https://home.abraham16.com/` → grep for `x-frame-options`, `x-content-type-options`, `referrer-policy`, `content-security-policy`, and CONFIRM `x-powered-by` is ABSENT
   - `curl -sIk https://home.server.mtcd.org/` → same header checks

10. If ANY smoke test fails, STOP and print the failing test.

## Rollback

If deploy breaks either server:

```bash
git revert HEAD --no-edit
git push origin main
git push origin abraham-prod   # or matching branch
```

Both stacks will auto-redeploy to v1.12.1.

## Ben's fences (reminder)

- No force-push
- Do not delete `.bak` files
- Do not modify `src/auth.ts`, `src/lib/permissions.ts`, `src/lib/iam.ts`, `api/iam/*`, `entrypoint.sh`
- No emojis in commit message or code
- Do not use "scrape" or "crawl" language in comments or logs

## Notify on completion

POST `/notify`:
- Title: `Dashboard v1.13.0 security patches live`
- Body: `Deployed to both servers. All post-deploy smoke tests: <PASS/FAIL summary>. Audit items fixed: C1, C2, C3, H1, H2, H3, H5-H10, M1, M2, L1.`
- Prio: `high` if any smoke test failed, else `default`

If any step errors mid-flight, STOP, do NOT auto-retry, print `QUESTION: <what>` with current git status and last successful step.
