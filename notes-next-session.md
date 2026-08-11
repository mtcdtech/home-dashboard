# Notes for Next Session: Home Dashboard

## Recommended Next Steps & Performance Follow-ups
1. **Curated Icon Allow-list for Lucide**: Replace wildcard `LucideIcons` import in `IconPicker.tsx` / `Dashboard.tsx` with a curated allow-list or map to enable tree-shaking for icons.
2. **Modal Lazy Loading**: Lazy-load heavy modals (`ThemeModal`, `TabModal`, `SectionModal`, `BookmarkModal`) using `next/dynamic` to reduce initial client bundle size.
3. **Prisma Permission Filtering**: Push per-user permission filtering into Prisma `where` queries directly rather than filtering in JavaScript post-fetch (`resolveTabAccess`/`resolveSectionAccess`).
4. **Tab Tree Caching**: Evaluate `unstable_cache` or Redis/React cache for tab tree queries if permission model permits.
5. **Post-Deployment Verification**:
   - Verify `v1.11.0` is deployed and live at `https://home.server.mtcd.org/`.
   - Verify the login button on the login screen says **"Log in Securely"** and footer shows `v1.11.0`.
   - Test logging in via Authentik as an administrator (e.g. `tech@mtcd.org` / `ben@abraham16.com` or `avcoordinator@mtcd.org`) and verify you are granted admin permissions in the home dashboard.

