# Home Dashboard — Security Quick Hits (v1.13.1)

## Test mode: DEPLOY-FIRST

## Scope — 8 small changes, one commit

All items are single-file or trivial, low-risk. Batch into one v1.13.1 (bug/hardening bump).

### M6: Replace `Math.random()` with `crypto.randomBytes` for IAM API key
- **Where:** `src/app/admin/actions.ts` around L2046-2047 in `regenerateIamApiKey`
- **Fix:** Replace `Math.random()`-based key generation with:
  ```ts
  import { randomBytes } from "crypto";
  const key = `iam_live_${randomBytes(32).toString("hex")}`;
  ```

### M7: Stop accepting IAM API key in URL query params
- **Where:** `src/app/api/iam/roles/route.ts` L12-14 and `src/app/api/iam/users/route.ts` L13-15
- **Fix:** Remove the `?api_key=` fallback. Accept only `Authorization: Bearer <key>` and `X-API-Key: <key>` headers. Return 401 if neither header present.
- **Note:** This is a **behavior change** for any external caller currently using `?api_key=`. Check `docker logs dashboard-app | grep 'api_key='` on both servers before change — if there are recent hits, add a deprecation warning log for 1 release instead of removing. If zero hits in last 24h, remove immediately.

### L2: Timing-safe comparison for IAM key + sync token
- **Where:**
  - `src/lib/iam.ts` L110 (`cleanProvided === validKey.trim()`)
  - `src/app/api/sync/workspace/route.ts` L37 (sync token comparison)
- **Fix:** Use `crypto.timingSafeEqual` with equal-length Buffer conversion:
  ```ts
  import { timingSafeEqual } from "crypto";
  function safeEq(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
  ```

### L3: Bind dev Postgres to 127.0.0.1
- **Where:** `docker-compose.yml` L44
- **Fix:** Change `5434:5432` → `127.0.0.1:5434:5432`
- **Note:** Dev-only file. Production Synology/abraham stacks don't use this compose file. No prod risk.
- **Ben's fence** says do not modify `docker-compose.yml` — CHECK: I'm asking Ben to confirm this specific one-line dev-only change is allowed. If the runbook is dispatched without explicit confirmation, SKIP L3 and note it as "deferred pending Ben's approval" in change-tracker.

### L4: Add `checks: ["pkce", "state"]` to Synology and Microsoft-Entra-ID providers
- **Where:** `src/auth.config.ts` L108-160
- **Fix:** Add `checks: ["pkce", "state"]` to the `synology` and `microsoft-entra-id` provider configs (Authentik variants already have it).
- **Ben's fence** says do not modify `src/auth.ts` — this is `auth.config.ts`, a different file. Confirm we CAN edit `auth.config.ts`. If unsure, STOP and print QUESTION.

### L5 + M8: Rate limiting via in-memory token bucket
- **Where:** Create `src/lib/rate-limit.ts` with a simple sliding-window limiter keyed by IP (`req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown"`)
- **Apply to:**
  - `src/app/api/track/click/route.ts` — 60 requests / IP / minute (M8)
  - `src/app/api/auth/[...nextauth]/route.ts` — 10 requests / IP / minute on POST only (L5, brute-force guard)
- **Behavior:** Over-limit returns 429 with `Retry-After: 60` header
- **Storage:** Per-container in-memory `Map<ip, timestamps[]>`, cleaned when checking. Not shared across abraham/mtcd — adequate for self-hosted low-traffic use. Document this limitation in the file's top comment.

### L6: Sanitize imported bookmark URLs
- **Where:** `src/lib/bookmark-parser.ts` L46-51, `src/app/admin/actions.ts` L1437 (`executeBookmarkImport`)
- **Fix:** In `parseBookmarksHtml`, filter out any `href` starting with `javascript:`, `data:`, `vbscript:`, `file:` (case-insensitive). Also call `normalizeUrl()` on remaining URLs before storing. If `normalizeUrl` doesn't exist in the codebase yet, keep the filter step only.

### I3: DNS-rebinding TOCTOU note
- **Where:** `src/lib/ssrf.ts` L12-33
- **Fix:** This is a fundamental limitation of `fetch()` — the only real fix is to resolve DNS once, then connect by IP with the Host header set. That's a bigger refactor.
- **Action for this runbook:** Add a code comment at the top of `isSafeUrl` documenting the TOCTOU window and referencing this as tracked in `notes-next-session.md`. Add a `notes-next-session.md` entry for the followup.

### I1 + I2: Documentation-only
- **I1:** Add a comment in `src/auth.config.ts` next to the first `allowDangerousEmailAccountLinking: true` explaining the intent (cross-IdP account linking by verified email) and the trust assumption.
- **I2:** In `prisma/schema.prisma` add a comment above the `Session` model noting it's unused (JWT strategy in effect). Do NOT delete the model — keep it in case strategy changes.

## Version bump

1.13.0 → **1.13.1** (bug/hardening — no user-facing changes, some subtle behavior tightening).

## Ben's fences

- No force-push
- Do not delete `.bak` files
- **Explicitly allowed for THIS runbook:** minor edits to `docker-compose.yml` (L3 change only), `src/auth.config.ts` (L4), `prisma/schema.prisma` (I2 comment only). Ben approved these in the parent dispatch.
- Do NOT touch: `src/auth.ts`, `src/lib/permissions.ts`, `src/lib/iam.ts` (except adding `timingSafeEqual` per L2), `api/iam/*` route handlers (except removing the query-param key path per M7), `entrypoint.sh`

## Files touched (expected)

- `src/app/admin/actions.ts` — M6 crypto import + one line change
- `src/app/api/iam/roles/route.ts` — M7
- `src/app/api/iam/users/route.ts` — M7
- `src/lib/iam.ts` — L2 (comparison only)
- `src/app/api/sync/workspace/route.ts` — L2
- `docker-compose.yml` — L3
- `src/auth.config.ts` — L4 + I1 comment
- `src/lib/rate-limit.ts` — new file (L5, M8)
- `src/app/api/track/click/route.ts` — apply rate limit
- `src/app/api/auth/[...nextauth]/route.ts` — apply rate limit on POST
- `src/lib/bookmark-parser.ts` — L6 protocol filter
- `src/app/admin/actions.ts` — L6 URL sanitize before insert (in executeBookmarkImport)
- `src/lib/ssrf.ts` — I3 comment
- `prisma/schema.prisma` — I2 comment
- `change-tracker.md`, `current-state.md`, `notes-next-session.md`
- Footer version literal + package.json version

## Build & deploy

1. Read all target files first, print a plan.
2. Make edits.
3. Local build: `npm run build`. If fails, STOP.
4. Single commit:
   ```
   feat(security): v1.13.1 — quick hardening hits (M6/M7/L2-L6/M8/I1-I3)
   ```
5. Push `main` (deploys MTCD) → poll for v1.13.1 in footer, max 5 min.
6. Push `abraham-prod` → poll home.abraham16.com for v1.13.1.
7. Smoke tests:
   - `curl -sik https://home.abraham16.com/api/iam/users?api_key=fake` → expect 401 (M7 — key no longer accepted in query)
   - `curl -sik https://home.server.mtcd.org/api/iam/users?api_key=fake` → expect 401
   - Hammer `/api/track/click` 65 times, expect at least one 429 in the last 5:
     ```
     for i in $(seq 1 65); do curl -sk -o /dev/null -w "%{http_code} " -X POST https://home.server.mtcd.org/api/track/click -H "Content-Type: application/json" -d '{"bookmarkId":"t","bookmarkTitle":"x","bookmarkUrl":"http://x"}'; done; echo
     ```
     Then check MTCD DB: `ClickEvent` row count should not have grown by 65 (some were rate-limited).
   - Same for abraham (5 rounds of 65 rapid-fire).

## Rollback

`git revert HEAD && git push origin main && git push origin abraham-prod`

## Notify on completion

- Title: `Dashboard v1.13.1 quick hardening live`
- Body: `Deployed to both servers. Smoke tests: <PASS/FAIL>. Items fixed: M6, M7, L2, L3, L4, L5, L6, M8 + I1/I2/I3 docs.`
- Prio: `default` (or `high` on any FAIL)

If any step errors: STOP, print `QUESTION: <what>` with git status. No blind retries.
