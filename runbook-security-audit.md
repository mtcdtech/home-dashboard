# Home Dashboard — Security Audit Runbook

## Test mode: N/A (audit-only, no code changes, no deploy)

## Mission

Produce a prioritized security-findings report for `github.com/mtcdtech/home-dashboard`. Static code review + live probes against BOTH deployed servers. **Report only** — no fixes, no commits, no pushes, no version bumps.

## Ground rules

- **NO source code changes.** No `git add`, no `git commit`, no `git push`. No file writes to `src/`, `api/`, `prisma/`, or config files.
- **NO destructive live probes.** No brute-force, no fuzzing rate that could DoS, no writes/mutations to endpoints. GET/HEAD only, and only to your own servers.
- **Live-probe targets (yours only):**
  - `https://home.abraham16.com` (abraham Mac Mini)
  - `https://home.server.mtcd.org` (MTCD Synology)
  - Do NOT probe any other domain. Especially not Authentik (`auth.*`), Portainer (`docker.*`), Planning Center, or Microsoft.
- **NO secrets in output.** If you find hardcoded tokens/keys/passwords, redact to first 4 chars + `...` in the report. Do not print full values.
- **Findings only from Ben's code and Ben's servers.** Third-party dependencies get npm audit + a note; don't audit their source.

## Deliverable

Write findings report to: `security-audit-report.md` in the repo root (workspace). Do NOT commit it. It's a scratch file — Ben will read it via the bridge.

Report structure:

```markdown
# Home Dashboard Security Audit — 2026-08-13

## Executive summary
- Total findings: X (Critical: A, High: B, Medium: C, Low: D, Info: E)
- Live-probe results: <summary>
- Top 3 risks: <bullets>

## Findings by severity

### CRITICAL
#### C1: <title>
- **Where:** `path/to/file.ts:LINE`
- **What:** <plain-English description>
- **Impact:** <what an attacker could do>
- **Reproduction:** <curl or code snippet showing the issue>
- **Fix:** <specific recommended change>

(...repeat per finding)

### HIGH / MEDIUM / LOW / INFO — same structure

## Live-probe log
<what was probed, what returned, whether it exposed anything>

## Dependency audit
<npm audit summary + high-severity CVEs>

## Not tested / out of scope
<explicit list>
```

## Audit checklist — go through EACH item

### 1. Authentication & session

- [ ] `src/auth.ts` — session validation, cookie flags (`HttpOnly`, `Secure`, `SameSite`), expiration logic
- [ ] Session token entropy — is it cryptographically random?
- [ ] Password/OTP handling — any plaintext, weak hashing, timing leaks
- [ ] Login endpoint — brute-force protection (rate limit, lockout)
- [ ] OIDC/OAuth callbacks — state parameter validation, PKCE, open-redirect on `redirect_uri`
- [ ] "Remember me" or long-lived tokens — expiration + revocation
- [ ] Logout — server-side session destruction, not just cookie clear
- [ ] Multi-provider flow (PCO/CC/MS/Authentik) — can auth from provider A get session as user from provider B?
- [ ] Admin bypass paths — is there a dev/debug flag that skips auth in prod?

### 2. Authorization (IAM)

- [ ] `src/lib/permissions.ts`, `src/lib/iam.ts` — role/permission checks on every mutation endpoint
- [ ] `api/iam/*` routes — IDOR: can user A read/modify user B's data by changing an ID in the URL/body?
- [ ] Server actions in `src/app/admin/actions.ts` — every mutation must check `session.userId` + role
- [ ] Tab/Section/Bookmark ownership — can a non-owner edit or delete? Does `isReadOnlySync` protect against writes?
- [ ] Impersonation — is `impersonating` state validated? Can it be forged from client?
- [ ] Sync tokens — `syncSourceUrl` targets — is there SSRF risk if user supplies an internal URL?

### 3. Injection

- [ ] SQL injection — Prisma is safe if using the query builder. Check for any raw `$queryRaw` or `$executeRaw` with interpolated strings.
- [ ] Command injection — any `child_process.exec` or `spawn` with user input?
- [ ] Path traversal — file upload/download endpoints, `/api/uploads/*`. Verify paths are constrained to the uploads dir.
- [ ] XSS — `dangerouslySetInnerHTML` usage, user-supplied HTML in bookmark titles/descriptions/descriptions rendered without escaping
- [ ] SSRF — any server-side `fetch()` with user-supplied URL? (icon fetching, sync source URLs, webhook targets)

### 4. File upload / handling

- [ ] `/api/uploads/*` route — content-type validation, magic-byte check, size limit, filename sanitization
- [ ] Uploaded files — can attacker upload `.html`, `.svg`, `.exe`? SVG can carry XSS.
- [ ] Storage path — always inside `/app/public/uploads/`, never absolute, never `..`
- [ ] MIME sniffing headers — `X-Content-Type-Options: nosniff`

### 5. API security

- [ ] All `src/app/api/**/route.ts` files — enumerate each, list what auth check it does
- [ ] CSRF — Next.js server actions have some built-in protection but raw `POST /api/*` may not. Check for state-changing GETs.
- [ ] CORS — any `Access-Control-Allow-Origin: *`? Are credentialed requests allowed from any origin?
- [ ] Rate limiting — is there any? Login especially.

### 6. Cross-server sync

- [ ] `src/app/api/sync/workspace/route.ts` — the endpoint that returns sync payloads. Is it authenticated? Rate-limited? Does it leak user PII or other tabs beyond the shared one?
- [ ] Sync source URL — is it validated? Can it point to `http://localhost:*` or `169.254.169.254` (cloud metadata) for SSRF?

### 7. Secrets & config

- [ ] `.env`, `.env.local`, `.env.production` — are any committed? Check `git log --all -- .env*`
- [ ] Hardcoded tokens/passwords in `src/**/*.{ts,tsx,mjs,js}` — grep for common patterns (`Bearer `, `ptr_`, `sk_`, `api_key`, `password:`, `secret:`)
- [ ] Client-side exposure — anything with `NEXT_PUBLIC_` that shouldn't be public
- [ ] Docker: does `docker-compose.yml` in the repo expose ports to `0.0.0.0` that should be internal?

### 8. Headers & transport

- [ ] Live probe both servers with `curl -sIk https://home.abraham16.com/ | grep -iE 'strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy'`
- [ ] Missing CSP → XSS amplifier
- [ ] Missing HSTS → downgrade risk
- [ ] Missing `X-Frame-Options` / `frame-ancestors` → clickjacking

### 9. Dependencies

- [ ] `cd /Users/benny2168/Antigravity/home-dashboard-mtcd && npm audit --production --json 2>/dev/null | head -200`
- [ ] Report ONLY critical + high severity from production deps. Ignore dev deps unless something egregious.
- [ ] Prisma, Next.js, React versions — any known CVEs applicable to the versions in use?

### 10. Live probes (external attacker perspective)

For BOTH `https://home.abraham16.com` and `https://home.server.mtcd.org`:

- [ ] `curl -sIk https://<host>/` — response headers
- [ ] `curl -sik https://<host>/api/uploads/` — dir listing? auth required?
- [ ] `curl -sik https://<host>/api/sync/workspace/does-not-exist` — auth check on missing IDs
- [ ] `curl -sik https://<host>/api/iam/users` — unauth attempt (should be 401/403)
- [ ] `curl -sik https://<host>/api/admin/anything` — unauth attempt on admin routes
- [ ] `curl -sik https://<host>/_next/static/chunks/` — any info leak?
- [ ] `curl -sik https://<host>/.env` and `/.git/config` — should 404
- [ ] `curl -sik https://<host>/api/health` (or similar) — does it leak version, DB status, env details?

Rate: 1 request per endpoint per host. No fuzzing loops.

## Prioritization

- **CRITICAL** — remote unauthenticated RCE, auth bypass, secret leak that's exploitable, SQL injection on user-facing endpoint
- **HIGH** — authenticated privilege escalation, IDOR affecting other users, stored XSS, SSRF, missing authz on state-changing endpoint
- **MEDIUM** — CSRF on non-critical endpoint, missing security headers with impact, weak session flags, verbose error messages
- **LOW** — missing defense-in-depth headers, dependency deprecation without known exploit, minor info disclosure
- **INFO** — best-practice suggestions, hardening opportunities

## Acceptance

- `security-audit-report.md` exists in workspace root
- Report contains at minimum: exec summary, findings list, live-probe log, dep audit, out-of-scope
- No secrets printed in full (redacted to 4 chars)
- No source code modified — `git status` in workspace should show only the new `security-audit-report.md` (untracked)
- No commits/pushes made

## On completion

POST `/notify`:
- Title: `Security audit complete`
- Body: `Total findings: N (Crit A, High B, Med C, Low D). Report at security-audit-report.md. Live probes clean/found issues on <hosts>.`
- Prio: `default` (or `high` if any Critical findings)

If any step errors, STOP and write partial report to `security-audit-report.md` with a `## AUDIT INCOMPLETE` header explaining what wasn't checked. Do not skip errors silently.
