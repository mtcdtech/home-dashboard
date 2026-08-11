# Notes for Next Session: Home Dashboard

## Deploy Contract (canonical, as of 2026-08-11)
- **Both servers are deployed from `mtcdtech/home-dashboard`.** There is no active abraham fork.
  - Push to `main` → deploys to Church Synology (`https://home.server.mtcd.org`)
  - Push to `abraham-prod` → deploys to Abraham Mac Mini (`https://home.abraham16.com`)
  - To deploy to BOTH: push to `main`, then `git push origin main:abraham-prod`
- **Multi-arch is safe.** Every push builds native amd64 + arm64 in parallel and combines them into a single manifest tagged by SHA / version / `latest`. Portainer pulls the SHA-tagged image, so arch mismatches at runtime are impossible.
- **Silent hangs are dead.** Build jobs have `timeout-minutes: 25`, deploy has 15, and the deploy job POLLS the live login page for 10 minutes checking that the footer version matches `package.json`. If it doesn't match, the workflow fails red — no more "shipped to git but still on old version" surprises.
- **`benny2168/home-dashboard` is a dead fork.** It has no CI and never actually deployed anything to any live site. Slated for archive on GitHub (needs Ben's own admin access to complete). Any local work Ben still wants to keep in that clone should be transplanted to a branch of `mtcdtech/home-dashboard`.

## Recommended Next Steps & Performance Follow-ups
1. **Archive `benny2168/home-dashboard`** on github.com when you get a moment (Settings → General → scroll to Danger Zone → Archive this repository). Local clone at `/Users/benny2168/Antigravity/home-dashboard-abraham` still has uncommitted WIP (entrypoint.sh, LoginForm.tsx, page.tsx) — decide whether to port those to a mtcd branch first.
2. **Curated Icon Allow-list for Lucide**: Replace wildcard `LucideIcons` import in `IconPicker.tsx` / `Dashboard.tsx` with a curated allow-list or map to enable tree-shaking for icons.
3. **Modal Lazy Loading**: Lazy-load heavy modals (`ThemeModal`, `TabModal`, `SectionModal`, `BookmarkModal`) using `next/dynamic` to reduce initial client bundle size.
4. **Prisma Permission Filtering**: Push per-user permission filtering into Prisma `where` queries directly rather than filtering in JavaScript post-fetch (`resolveTabAccess`/`resolveSectionAccess`).
5. **Tab Tree Caching**: Evaluate `unstable_cache` or Redis/React cache for tab tree queries if permission model permits.

## Post-Deploy Sanity Checks (do these after any real change)
- Both `https://home.server.mtcd.org/login` and `https://home.abraham16.com/login` footers show the version from `package.json`.
- Login button says "Log in Securely".
- Log in via Authentik as an administrator (e.g. `tech@mtcd.org`, `ben@abraham16.com`, `avcoordinator@mtcd.org`) and verify admin permissions land correctly.
