You are working in:

/Users/benny2168/Dockers/MTCD/docker/antigravity/mtcd-workspaces/homedashboard

Branch:
security-efficiency-hardening

Goal:
Fix the hardening branch so it builds, passes tests, and is safe to review again. Do not merge to main. Do not deploy.

Current review verdict:
FAIL — not safe to merge or deploy.

You did make some good progress:
- `/api/debug-auth` removed
- `AUTH_SECRET` de-hardcoded
- dev credentials gated
- upload path traversal partially/fully addressed

But the branch currently has build-breaking and security-breaking issues that must be fixed.

Required fix order:

1. Restore a clean validation baseline

Run:

```bash
git status --short
git branch --show-current
npx prisma generate
npm run build
npx tsc --noEmit
```

Capture the current failures before fixing.

2. Fix build-breaking `actions.ts` issues

File:
`src/app/admin/actions.ts`

Problems:
- `urlObj` is redeclared around lines 93 and 112.
- Many server actions use `arguments[0]`, which Next.js Server Actions forbids.

Requirements:
- Remove all `arguments[0]` usage.
- Do not use dynamic argument inspection in server actions.
- Change guard calls to use explicit named parameters already present in each function signature.
- If a function has no relevant resource ID, use `requireAdmin()` or `requireSession()` appropriately.
- Ensure `npm run build` no longer fails due to server action syntax.

3. Fix broken authz resolver integration

File:
`src/lib/authz.ts`

Problem:
`requireTabRole` passes `user.id` directly into `resolveTabAccess`, but `resolveTabAccess` expects a full `UserContext`.

Requirements:
- Import and use `buildUserContext` from `src/lib/permissions.ts`.
- Load the current user and relevant grant data needed by the resolver.
- Pass a proper `UserContext` into `resolveTabAccess` and `resolveSectionAccess`.
- Keep master-admin bypass behavior.
- Fail closed if user/session/resource is missing.

Expected helper behavior:
- `requireSession()` returns the current authenticated user/session.
- `requireAdmin()` requires admin/master-admin status.
- `requireMasterAdmin()` requires master admin if the app distinguishes this.
- `requireTabRole(tabId, minimumRole)` validates effective tab/workspace access.
- `requireSectionRole(sectionId, minimumRole)` validates effective section access.

4. Fix wrong resource guard calls

File:
`src/app/admin/actions.ts`

Problem:
Some section actions pass `sectionId` into `requireTabRole`.

Known examples:
- `addSectionToTab`
- `removeSectionFromTab`
- `updateSectionLayout`
- `moveSection`
- `pushSectionToDepartment`

Requirements:
- Use `requireSectionRole(sectionId, "editor")` or `"owner"` for section-level actions.
- Use `requireTabRole(tabId, "editor")` or `"owner"` for workspace/tab-level actions.
- For actions linking a section to a tab, check both resources if needed:
  - caller can edit/own the target tab
  - caller can view/edit/own the section depending on action semantics

5. Fix `updateUserDefaultTab` authorization

File:
`src/app/admin/actions.ts`

Problem:
`updateUserDefaultTab(userId, …)` only requires a session, so one user can mutate another user’s record.

Requirements:
- Allow user to update only their own default tab.
- Allow admins/master admins to update another user’s default tab if that is intended.
- Validate that the target tab is visible to the target user before setting it.
- Fail closed.

6. Finish SSRF hardening

Files to inspect:
- `src/app/admin/actions.ts`
- any helper used by `downloadImageFromUrl`
- sync/import/favicons/image download helpers

Problem:
Current SSRF guard only blocks `localhost`, `127.0.0.1`, `::1`, and `0.0.0.0`.

Requirements:
- Allow only `http` and `https`.
- Reject:
  - localhost
  - loopback IPv4/IPv6
  - private IPv4 ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - link-local: `169.254.0.0/16`
  - metadata IP: `169.254.169.254`
  - multicast/reserved ranges
  - IPv6 unique-local/link-local ranges
  - internal hostnames if detectable
- Resolve DNS and validate resolved IPs before fetching.
- Guard against DNS rebinding where practical by validating the final URL/redirect target.
- Disable or tightly limit redirects, or validate each redirect target.
- Add fetch timeout.
- Add max response size.
- Validate image MIME type before writing files.
- Do not write fetched content into public/static storage unless validation passes.

7. Restore or recreate permissions tests

Problem:
`node scratch/permissions.test.mjs` fails because the file is missing.

Requirements:
- Restore `scratch/permissions.test.mjs`.
- It should test the central permissions resolver.
- Expected result: 20/20 passing, or better.
- Keep it runnable with plain Node and no test framework if that is the repo pattern.

8. Add security regression tests/scripts

If no formal test framework exists, add deterministic scripts under `scratch/`.

Required coverage:
- non-admin cannot call/admin-gated mutator logic
- locked push cannot be removed
- upload path traversal is rejected
- SSRF URL validator rejects private/link-local/metadata URLs
- user cannot update another user’s default tab
- resolver still handles pushed/locked/inherited access

Suggested files:
- `scratch/security.test.mjs`
- `scratch/permissions.test.mjs`

9. Fix remaining UI runtime bug

File:
`src/app/admin/theme/ThemeClient.tsx`

Problem:
`setBackgroundColor` is undefined.

Requirement:
- Define the missing state setter or remove the stale call.
- Confirm the theme editor no longer crashes on background upload.

10. Propagate pushed/locked metadata to dashboard

Files:
- `src/app/page.tsx`
- `src/components/Dashboard.tsx`

Requirements:
- Preserve resolver metadata:
  - `pushed`
  - `locked`
  - `source`
  - `inherited`
- Send needed metadata to the dashboard client.
- Hide or disable “Remove Workspace” for locked pushed workspaces.
- Keep server-side enforcement in `removeTabFromUser`.

11. Do not attempt broad efficiency work until security/build passes

After security/build passes, only then address easy efficiency fixes:
- icon clients should use `/api/icons`
- reduce obvious JSON deep clones
- remove automatic imported workspace refresh on tab switch if still present
- clean obvious tracked scratch/log/pid files
- fix duplicate/conflicting React dependency declarations if present

Do not do massive speculative rewrites in this branch.

12. Validation gate

Before saying done, run:

```bash
npx prisma generate
node scratch/permissions.test.mjs
node scratch/security.test.mjs
npm run build
npx tsc --noEmit
```

If `npx tsc --noEmit` still fails from pre-existing issues:
- prove whether this branch introduced new TS errors
- list the remaining errors
- do not hide new errors

13. Final output required

When done, report:

- current branch
- latest commit SHA
- files changed
- exact security issues fixed
- exact remaining risks, if any
- validation command results
- whether `npm run build` passes
- whether `node scratch/permissions.test.mjs` passes
- whether `node scratch/security.test.mjs` passes
- whether safe to merge
- whether safe to deploy

Do not merge to main.
Do not deploy.