# Home Dashboard → Authentik SSO Transition Plan

**Goal:** Replace direct Microsoft Entra + Synology auth in `mtcdtech/home-dashboard` with two dedicated Authentik OAuth providers — one per button — using the same "Kutt pattern" already proven in `mtcdtech/prayer-wall`. Each button skips the Authentik chooser and goes straight to Microsoft or Planning Center.

**Critical context — read first:**
The `?source=URL_PARAM` Authentik bypass is **NOT a real feature**. Authentik's `IdentificationStage.ts` has zero logic to read `searchParams.get('source')` and auto-click a matching source button. The chooser screen always shows when an identification stage has multiple sources. The only working bypass (per Authentik 2023.5+ docs) is to have an identification stage with **zero `user_fields` AND exactly one source bound** — then the SPA auto-redirects. So the fix requires creating dedicated Authentik flows, providers, and applications per button. Do not attempt URL-parameter shortcuts; they will fail silently.

**Pattern reference (already deployed and working):** Prayer Wall uses Authentik providers `prayer-wall-pco` (pk=8) + `prayer-wall-ms` (pk=9), each with its own `authentication_flow` (`prayer-wall-pco-auto-login` / `prayer-wall-ms-auto-login`) bound to a single-source identification stage. Mirror this structure exactly.

---

## Differences from Prayer Wall (do not skip)

1. **NextAuth v5 (beta)** — home-dashboard uses `next-auth@^5.0.0-beta.30`. APIs differ from v4:
   - `signIn` is imported from `@/auth` (server) for server actions, or `next-auth/react` (client)
   - Provider config exports `authConfig` separately (Edge-safe split for middleware)
   - Callback URL pattern is `/api/auth/callback/<provider-id>` (same as v4)
2. **Prisma adapter** is in use — keep it. The `signIn` callback already upserts users into the local Prisma `User` table. Do not remove this — it's how the dashboard's role/department logic works.
3. **Two separate stacks deploy this app:**
   - **Stack 58 (`homedashboard`)** at `https://home.server.mtcd.org` — MTCD instance, the one to migrate to Authentik
   - **Stack 59 (`homedashboard`)** at `https://home.abraham16.com` — Abraham instance, currently uses Synology SSO. **Out of scope** for this Authentik migration unless explicitly requested. Plan handles only stack 58.
4. **CI workflow uses `update_portainer.py`** (not direct PUT in the workflow YAML like prayer-wall). The Python script must be updated to push the new env vars.
5. **Image name** is `mtcdtech/homedashboard` (no hyphen), tags `:latest` and `:abraham`.
6. **App listens on port 4000**, exposed externally on 4001. NextAuth callback URL must use the public host: `https://home.server.mtcd.org/api/auth/callback/...`

---

## Phase 1 — Authentik objects (API-driven, idempotent)

Use Authentik API at `https://auth.server.mtcd.org` with token `JJ1JgYWgXLSTaI025sTb9h4fAbI8SsR4xGmL9JGX4yQppWKptUf9kczqfOAi`.

Reuse these existing objects (same as prayer-wall):
- OAuth source `planning-center` pk=`f20ab69a-efd2-4fca-b689-575538ed9eff`
- OAuth source `azuread` pk=`e6c31d67-7bae-4db0-b172-81164cb89ecd`
- Stage `default-authentication-login` pk=`1e142f10-b654-4a01-ba5f-46eec8dcde6e`
- Authorization flow `default-provider-authorization-explicit-consent` pk=`b3e95a9d-9923-4938-82c9-a288d54fa195`
- Invalidation flow `default-provider-invalidation-flow` pk=`a0dbfa30-2b03-4c5a-9222-e252e1dba507`
- Signing key pk=`6eeafb57-c616-458a-b129-9c76c55108c3`
- Property mappings (OIDC scopes): `["29a47e3e-da05-4ba7-8b05-4752b9c53a4e","91e8c02e-b72d-45f3-baec-552d4f92b441","bc8e0194-22c6-4927-ac5e-7f0e0b9dda55","18051e7e-2079-48f9-8a86-bd8066867e09"]`
- Default policy `default-deny` (Deny All) pk=`7b56499b-fe40-4646-b3c3-fc69212045e3`
- Group `Authentik Admins` pk=`d3baf9f1-49ba-4855-96cd-505f47086e29`

### 1a. Create the access groups (new, app-specific taxonomy)

Match the prayer-wall taxonomy: `app-<slug>-{users,admins,global-admins}`. Create with `POST /api/v3/core/groups/`:

```json
{ "name": "app-home-dashboard-users",         "is_superuser": false, "parent": null }
{ "name": "app-home-dashboard-admins",        "is_superuser": false, "parent": null }
{ "name": "app-home-dashboard-global-admins", "is_superuser": false, "parent": null }
```

Save the returned `pk` for each — they're needed later. **Do not** add members yet; that's Phase D-style backfill, separate from this migration.

### 1b. Create two single-source identification stages

`POST /api/v3/stages/identification/`:

```json
{
  "name": "home-dashboard-pco-only-identification",
  "user_fields": [],
  "sources": ["f20ab69a-efd2-4fca-b689-575538ed9eff"],
  "show_source_labels": true,
  "case_insensitive_matching": true,
  "show_matched_user": false,
  "pretend_user_exists": true,
  "enable_remember_me": false
}
```

```json
{
  "name": "home-dashboard-ms-only-identification",
  "user_fields": [],
  "sources": ["e6c31d67-7bae-4db0-b172-81164cb89ecd"],
  "show_source_labels": true,
  "case_insensitive_matching": true,
  "show_matched_user": false,
  "pretend_user_exists": true,
  "enable_remember_me": false
}
```

The combination `user_fields=[]` + exactly one source is what triggers the SPA auto-redirect. Do not change either field.

### 1c. Create two auto-login flows

`POST /api/v3/flows/instances/`:

```json
{
  "name": "Home Dashboard Auto-Login via Planning Center",
  "slug": "home-dashboard-pco-auto-login",
  "title": "Redirecting to Planning Center...",
  "designation": "authentication",
  "policy_engine_mode": "any",
  "compatibility_mode": false,
  "layout": "stacked",
  "denied_action": "message_continue",
  "authentication": "none"
}
```

```json
{
  "name": "Home Dashboard Auto-Login via Microsoft",
  "slug": "home-dashboard-ms-auto-login",
  "title": "Redirecting to Microsoft...",
  "designation": "authentication",
  "policy_engine_mode": "any",
  "compatibility_mode": false,
  "layout": "stacked",
  "denied_action": "message_continue",
  "authentication": "none"
}
```

`authentication: "none"` is required — the flow runs before the user is authenticated.

### 1d. Bind stages to flows

For each flow, two bindings via `POST /api/v3/flows/bindings/`:
- `target=<flow-pk>`, `stage=<single-source-id-stage>`, `order=10`
- `target=<flow-pk>`, `stage=1e142f10-b654-4a01-ba5f-46eec8dcde6e` (login stage), `order=100`

All bindings: `evaluate_on_plan=false`, `re_evaluate_policies=true`, `policy_engine_mode="any"`, `invalid_response_action="retry"`.

### 1e. Create two OAuth providers

`POST /api/v3/providers/oauth2/`:

```json
{
  "name": "Home Dashboard (Planning Center)",
  "authentication_flow": "<home-dashboard-pco-auto-login-pk>",
  "authorization_flow": "b3e95a9d-9923-4938-82c9-a288d54fa195",
  "invalidation_flow": "a0dbfa30-2b03-4c5a-9222-e252e1dba507",
  "property_mappings": ["29a47e3e-da05-4ba7-8b05-4752b9c53a4e","91e8c02e-b72d-45f3-baec-552d4f92b441","bc8e0194-22c6-4927-ac5e-7f0e0b9dda55","18051e7e-2079-48f9-8a86-bd8066867e09"],
  "client_type": "confidential",
  "signing_key": "6eeafb57-c616-458a-b129-9c76c55108c3",
  "redirect_uris": [
    {"matching_mode": "strict", "url": "https://home.server.mtcd.org/api/auth/callback/authentik-pco"}
  ],
  "sub_mode": "hashed_user_id",
  "issuer_mode": "per_provider",
  "include_claims_in_id_token": true,
  "access_code_validity": "minutes=1",
  "access_token_validity": "minutes=5",
  "refresh_token_validity": "days=30"
}
```

Same for the MS provider, swapping name/auth_flow/redirect URI to `…/callback/authentik-ms`.

**Save the returned `client_id` and `client_secret` for each provider** — these go into Portainer env in Phase 3.

### 1f. Create two applications

`POST /api/v3/core/applications/`:

```json
{
  "name": "Home Dashboard (Planning Center)",
  "slug": "home-dashboard-pco",
  "provider": <pco-provider-pk>,
  "meta_launch_url": "https://home.server.mtcd.org/login",
  "meta_description": "Home Dashboard - Planning Center auto-login",
  "open_in_new_tab": false,
  "policy_engine_mode": "any"
}
```

Same for `home-dashboard-ms` with the MS provider. Each app's `slug` becomes the OIDC issuer path: `https://auth.server.mtcd.org/application/o/home-dashboard-{pco,ms}/`.

### 1g. Add access policy bindings to BOTH apps

For each of the two apps, `POST /api/v3/policies/bindings/` five times:

| order | field  | value                                                  | meaning |
|-------|--------|--------------------------------------------------------|---------|
| 5     | group  | `d3baf9f1-49ba-4855-96cd-505f47086e29`                 | Authentik Admins (always allow) |
| 10    | group  | `<app-home-dashboard-users pk>`                        | regular users |
| 15    | group  | `<app-home-dashboard-admins pk>`                       | app admins |
| 20    | group  | `<app-home-dashboard-global-admins pk>`                | global admins |
| 99    | policy | `7b56499b-fe40-4646-b3c3-fc69212045e3`                 | Deny All (catch-all) |

Each binding body:
```json
{"target":"<app-pk>","group":"<group-pk>","enabled":true,"order":<n>,"timeout":30,"failure_result":false,"negate":false}
```
(Use `"policy"` instead of `"group"` for the Deny All binding.)

**Watch out for this footgun:** when looking up app UUIDs by slug, `?slug=` may return both apps. Look up each by exact slug match and confirm the UUID before adding bindings, otherwise all bindings can land on the wrong app. (We hit this on prayer-wall and had to clean up duplicates.)

### 1h. Verify

After all of the above, hit each well-known endpoint — both should return valid OIDC config:
- `https://auth.server.mtcd.org/application/o/home-dashboard-pco/.well-known/openid-configuration`
- `https://auth.server.mtcd.org/application/o/home-dashboard-ms/.well-known/openid-configuration`

---

## Phase 2 — Code changes in `mtcdtech/home-dashboard`

### 2a. Update `src/auth.config.ts`

Replace the `MicrosoftEntraID` provider (and optionally remove `synology` for stack 58) with two custom OIDC providers. Keep the file Edge-safe (no Prisma imports here — Prisma stays in `auth.ts`).

```ts
import type { NextAuthConfig } from "next-auth";

const providers: any[] = [];

// Authentik OIDC -> Planning Center (auto-redirect via dedicated single-source flow)
if (process.env.AUTHENTIK_PCO_CLIENT_ID) {
  providers.push({
    id: "authentik-pco",
    name: "Planning Center",
    type: "oidc",
    issuer: process.env.AUTHENTIK_PCO_ISSUER,            // https://auth.server.mtcd.org/application/o/home-dashboard-pco/
    clientId: process.env.AUTHENTIK_PCO_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_PCO_CLIENT_SECRET,
    authorization: { params: { scope: "openid email profile groups" } },
    checks: ["pkce", "state"],
    allowDangerousEmailAccountLinking: true,
    profile(profile: any) {
      return {
        id: profile.sub,
        name: profile.name || profile.preferred_username,
        email: profile.email,
        image: profile.picture || null,
        department: "",      // populated in signIn callback from groups
        isAdmin: false,
      };
    },
  });
}

// Authentik OIDC -> Microsoft Entra (auto-redirect via dedicated single-source flow)
if (process.env.AUTHENTIK_MS_CLIENT_ID) {
  providers.push({
    id: "authentik-ms",
    name: "Microsoft",
    type: "oidc",
    issuer: process.env.AUTHENTIK_MS_ISSUER,             // https://auth.server.mtcd.org/application/o/home-dashboard-ms/
    clientId: process.env.AUTHENTIK_MS_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_MS_CLIENT_SECRET,
    authorization: { params: { scope: "openid email profile groups" } },
    checks: ["pkce", "state"],
    allowDangerousEmailAccountLinking: true,
    profile(profile: any) {
      return {
        id: profile.sub,
        name: profile.name || profile.preferred_username,
        email: profile.email,
        image: profile.picture || null,
        department: "",
        isAdmin: false,
      };
    },
  });
}

// Keep Synology for Abraham instance (stack 59) — unchanged
if (process.env.SYNOLOGY_CLIENT_ID) {
  providers.push({
    id: "synology",
    name: "Synology SSO",
    type: "oidc",
    clientId: process.env.SYNOLOGY_CLIENT_ID,
    clientSecret: process.env.SYNOLOGY_CLIENT_SECRET,
    issuer: process.env.SYNOLOGY_ISSUER,
    authorization: { params: { scope: "openid email groups" } },
    allowDangerousEmailAccountLinking: true,
    profile(profile: any) {
      return {
        id: profile.sub,
        name: profile.description || profile.name || profile.username || profile.sub,
        email: profile.email || `${profile.username}@abraham16.com`,
        image: null,
        department: profile.groups?.includes("administrators") ? "Admin" : "Synology",
        isAdmin: false,
      };
    },
  });
}

export const authConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // (unchanged from current — paste existing body verbatim)
    },
  },
  providers,
} satisfies NextAuthConfig;
```

**Do not** delete the `MicrosoftEntraID` import block until stack 58 is verified working — keep it commented in case of rollback. After Phase 4 verification, remove it.

### 2b. Update `src/auth.ts` `signIn` callback

The existing `signIn` callback only handles `microsoft-entra-id` and `synology` provider IDs. Add branches for the new IDs. Replace the inner `if (account?.provider === ...)` block with:

```ts
let department = "";
let isGroupAdmin = false;
const groups: string[] = (profile?.groups as string[]) || [];

if (account?.provider === "microsoft-entra-id" && profile) {
  department = (profile as any).department || "";
} else if (account?.provider === "synology" && profile) {
  isGroupAdmin = groups.includes("administrators");
  department = isGroupAdmin ? "Admin" : "Synology";
} else if (account?.provider === "authentik-pco" || account?.provider === "authentik-ms") {
  // Authentik returns groups as an array of names from the property mapping
  isGroupAdmin =
    groups.includes("app-home-dashboard-global-admins") ||
    groups.includes("app-home-dashboard-admins") ||
    groups.includes("Authentik Admins");
  // Department mapping is left blank by default; the existing dashboardGroup
  // upsert logic will fall back to "General" for new users.
  department = "";
}
```

The `prisma.user.upsert` block below it already handles `isGroupAdmin → isAdmin: true`, so no change needed there.

### 2c. Update `src/app/login/page.tsx` (or wherever `LoginForm` is rendered)

Find where `hasMicrosoft` and `hasSynology` are computed (look for env-var checks driving those props). Add `hasAuthentikPco` and `hasAuthentikMs` props derived from `process.env.AUTHENTIK_PCO_CLIENT_ID` / `AUTHENTIK_MS_CLIENT_ID`. Pass them into `<LoginForm />`.

For stack 58 (MTCD) you'll set the new env vars and not the legacy MS/Synology ones, so only the two Authentik buttons render. For stack 59 (Abraham) you keep the Synology var set, so its button still renders.

### 2d. Rewrite `src/app/login/LoginForm.tsx` button block

Replace the existing `{hasMicrosoft && (...)}` and `{hasSynology && (...)}` blocks with the two new buttons. Keep the existing styling — just swap the provider IDs and labels:

```tsx
{hasAuthentikPco && (
  <button
    onClick={() => signIn("authentik-pco", { callbackUrl: "/" })}
    aria-label="Sign in with Planning Center"
    style={{ /* keep the same glass-button styles as the current Microsoft button,
                 but with the PCO gradient: linear-gradient(90deg,#449bf2,#5dd4a7) */ }}
  >
    <img src="/brand/pco.png" alt="" width={20} height={20} />
    <span>Sign in with Planning Center</span>
  </button>
)}

{hasAuthentikMs && (
  <button
    onClick={() => signIn("authentik-ms", { callbackUrl: "/" })}
    aria-label="Sign in with Microsoft (@mtcd.org)"
    style={{ /* keep current MS button styles; in dark mode use bg #000 + text #fff */ }}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="0"  width="11" height="11" fill="#F25022"/>
      <rect x="13" y="0" width="11" height="11" fill="#7FBA00"/>
      <rect x="0" y="13" width="11" height="11" fill="#00A4EF"/>
      <rect x="13" y="13" width="11" height="11" fill="#FFB900"/>
    </svg>
    <span>Sign in with Microsoft (@mtcd.org)</span>
  </button>
)}
```

The "(@mtcd.org)" suffix matches the prayer-wall convention so users know which tenant. Keep the credentials-based local admin section as-is.

### 2e. Add the PCO logo asset

Copy the PCO logo to `public/brand/pco.png` (transparent background, ~48 KB). Same file used by prayer-wall. If middleware blocks `/brand/*`, add it to the public-paths matcher (check `src/middleware.ts` if present; home-dashboard's `auth.config.ts` `authorized` callback already has a `isPublicAsset` block — add `nextUrl.pathname.startsWith("/brand")` to it).

### 2f. Update `docker-compose.prod.yml` and the repo's `docker-compose.yml`

Add the new env passthroughs to the `app` service `environment:` block:

```yaml
- AUTHENTIK_PCO_CLIENT_ID=${AUTHENTIK_PCO_CLIENT_ID}
- AUTHENTIK_PCO_CLIENT_SECRET=${AUTHENTIK_PCO_CLIENT_SECRET}
- AUTHENTIK_PCO_ISSUER=${AUTHENTIK_PCO_ISSUER:-https://auth.server.mtcd.org/application/o/home-dashboard-pco/}
- AUTHENTIK_MS_CLIENT_ID=${AUTHENTIK_MS_CLIENT_ID}
- AUTHENTIK_MS_CLIENT_SECRET=${AUTHENTIK_MS_CLIENT_SECRET}
- AUTHENTIK_MS_ISSUER=${AUTHENTIK_MS_ISSUER:-https://auth.server.mtcd.org/application/o/home-dashboard-ms/}
```

These also need to be added to the live Portainer compose for stack 58 (Phase 3).

### 2g. Update `update_portainer.py`

The existing payload only pushes `AUTH_MICROSOFT_ENTRA_ID_SECRET` and `AUTH_SECRET`. Extend the `payload["env"]` list to include the new vars so CI keeps them in sync:

```python
payload = {
    "stackFileContent": content,
    "env": [
        {"name": "AUTH_MICROSOFT_ENTRA_ID_SECRET", "value": entra_secret},
        {"name": "AUTH_SECRET",                   "value": auth_secret},
        # Only set these for stack 58 (MTCD); stack 59 leaves them blank.
        {"name": "AUTHENTIK_PCO_CLIENT_ID",       "value": os.environ.get("AUTHENTIK_PCO_CLIENT_ID","")},
        {"name": "AUTHENTIK_PCO_CLIENT_SECRET",   "value": os.environ.get("AUTHENTIK_PCO_CLIENT_SECRET","")},
        {"name": "AUTHENTIK_PCO_ISSUER",          "value": os.environ.get("AUTHENTIK_PCO_ISSUER","")},
        {"name": "AUTHENTIK_MS_CLIENT_ID",        "value": os.environ.get("AUTHENTIK_MS_CLIENT_ID","")},
        {"name": "AUTHENTIK_MS_CLIENT_SECRET",    "value": os.environ.get("AUTHENTIK_MS_CLIENT_SECRET","")},
        {"name": "AUTHENTIK_MS_ISSUER",           "value": os.environ.get("AUTHENTIK_MS_ISSUER","")},
    ],
    "prune": True,
    "pullImage": True,
}
```

**Better yet**, refactor the script to merge new vars into the stack's existing env (`GET /api/stacks/<id>` → list → upsert by `name` → PUT) so each stack only gets the vars relevant to it. This avoids leaking MTCD secrets into the Abraham stack.

### 2h. Add new GitHub Actions secrets

In the `mtcdtech/home-dashboard` repo settings → Secrets and variables → Actions, add:
- `AUTHENTIK_PCO_CLIENT_ID`
- `AUTHENTIK_PCO_CLIENT_SECRET`
- `AUTHENTIK_PCO_ISSUER` = `https://auth.server.mtcd.org/application/o/home-dashboard-pco/`
- `AUTHENTIK_MS_CLIENT_ID`
- `AUTHENTIK_MS_CLIENT_SECRET`
- `AUTHENTIK_MS_ISSUER` = `https://auth.server.mtcd.org/application/o/home-dashboard-ms/`

Pass them through to `update_portainer.py` in the `Trigger Portainer Updates` step's `env:` block.

---

## Phase 3 — Portainer stack 58 update

Same flow as prayer-wall: pull the current stack file + env, inject new compose passthroughs and new env values, PUT it back.

```bash
# Add these env vars to stack 58's Env array (preserve existing ones):
AUTHENTIK_PCO_CLIENT_ID=<from Authentik>
AUTHENTIK_PCO_CLIENT_SECRET=<from Authentik>
AUTHENTIK_PCO_ISSUER=https://auth.server.mtcd.org/application/o/home-dashboard-pco/
AUTHENTIK_MS_CLIENT_ID=<from Authentik>
AUTHENTIK_MS_CLIENT_SECRET=<from Authentik>
AUTHENTIK_MS_ISSUER=https://auth.server.mtcd.org/application/o/home-dashboard-ms/
```

And add the matching passthrough lines to the `app.environment` block of the compose body (mirror the `docker-compose.prod.yml` change).

PUT to `https://docker.server.mtcd.org/api/stacks/58?endpointId=2` with `X-API-Key: ptr_gApxPW/riEq8Kszyab2O76VXCQcLuIiazyOPFjOFJro=`. Use `PullImage: false` for the env-only update; the next `git push` will trigger the full image rebuild via CI and that will redeploy with `pullImage: true` per `update_portainer.py`.

**Do not touch stack 59** unless the Abraham instance also needs Authentik (out of scope per user statement).

---

## Phase 4 — Verification

1. Hit `https://home.server.mtcd.org/login` — both new buttons should render with correct labels.
2. Click **Sign in with Planning Center** — should redirect straight to PCO OAuth (no Authentik chooser screen). Authorize, callback should land on `/api/auth/callback/authentik-pco`, then `/`. Confirm the user is upserted into Prisma with `isAdmin=false` (assuming they're not in any access group yet — they should hit the Deny All policy and get `error=AccessDenied`).
3. Add yourself to `app-home-dashboard-global-admins` in Authentik, retry — you should now reach the dashboard with admin rights.
4. Click **Sign in with Microsoft (@mtcd.org)** — should redirect straight to `login.microsoftonline.com` (no chooser).
5. Confirm container logs show `JWT callback - user logged in: <email>` and `Session created for: <email> isAdmin: true`.

Roll back by removing the new env vars from stack 58 and reverting the code commit if needed — old `microsoft-entra-id` block is preserved (commented) until verified.

---

## Phase 5 — Cleanup (after verification holds for a week)

1. Delete the commented-out `MicrosoftEntraID` provider block from `auth.config.ts`.
2. Remove `AUTH_MICROSOFT_ENTRA_ID_*` env vars from stack 58 (keep them in stack 59 — Abraham still uses them if you ever wire up direct Entra there).
3. The old `dashboard-app-sso` Microsoft Entra app registration in Azure can be deleted or repurposed — it's no longer needed.
4. Decommission the Authentik provider 7 (`prayer-wall`) ONLY if also unused — it is not, leave it.
5. Document the new pattern in the repo's `README.md` and `agent.md` so future contributors know the Kutt-pattern requirement (zero `user_fields` + single source = auto-redirect; do not try `?source=` URL hacks).

---

## TL;DR for Gravity

> Migrate `mtcdtech/home-dashboard` (NextAuth v5, Prisma adapter) from direct Microsoft Entra to two dedicated Authentik OIDC providers using the proven Kutt pattern (single-source identification stage → auto-redirect). Mirror exactly what was done in `mtcdtech/prayer-wall` commit `66935a7`, but adapt to NextAuth v5 syntax. Create:
> - 3 Authentik groups: `app-home-dashboard-{users,admins,global-admins}`
> - 2 single-source identification stages: `home-dashboard-{pco,ms}-only-identification`
> - 2 auto-login flows: `home-dashboard-{pco,ms}-auto-login`
> - 2 OAuth providers: `Home Dashboard ({Planning Center,Microsoft})`
> - 2 applications: `home-dashboard-{pco,ms}` with full group + Deny All bindings
>
> Then rewrite `src/auth.config.ts` to add `authentik-pco` and `authentik-ms` OIDC providers (drop `MicrosoftEntraID`), update the `signIn` callback in `src/auth.ts` to read groups from the Authentik profile, replace the buttons in `src/app/login/LoginForm.tsx` (with the "(@mtcd.org)" suffix on the MS one), copy `public/brand/pco.png`, add new env passthroughs to `docker-compose.prod.yml`, extend `update_portainer.py` to push the new env vars, add 6 GitHub secrets, and PUT-update Portainer stack 58 with the new env values + compose. Only touch stack 58 (`home.server.mtcd.org`); leave stack 59 (Abraham) alone.
>
> The bypass that makes the chooser disappear is a single-source identification stage with `user_fields=[]` — verified server-side and per Authentik 2023.5+ docs. Do not attempt `?source=` URL parameters; they are silently ignored by Authentik.
