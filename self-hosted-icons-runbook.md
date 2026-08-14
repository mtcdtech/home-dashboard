# Runbook: Self-Hosted Icons Across Both Servers

**Version target:** 1.11.2 → 1.12.0 (minor bump — user-visible behavior change)
**Test mode:** DEPLOY-FIRST (needs live external CDNs + cross-server sync to fully verify)
**Repo:** `github.com/mtcdtech/home-dashboard` (single source of truth for both deployments)

---

## Goal

Every icon in the dashboard — for Bookmarks, Sections, and Tabs — must be stored as a file on the server (not an external URL). This eliminates brandfetch expirations, removes the current 90-second page hang, and cuts external-CDN dependency for both `home.abraham16.com` and `home.server.mtcd.org`.

Also make cross-server tab sharing keep working: when Ben pushes a tab from MTCD to Abraham (or vice versa), icons must transfer with the tab payload and land as local files on the receiver too.

---

## Non-goals

- Do NOT touch auth (`src/auth.ts`, `src/auth.config.ts`), IAM (`src/lib/permissions.ts`, `src/lib/iam.ts`, `api/iam/*`), Portainer widget, `entrypoint.sh`, or `.github/workflows/`
- Do NOT change the Prisma schema — reuse the existing `icon` and (Bookmark) `icon` columns
- Do NOT delete the existing `IconPicker` brandfetch search UX — Ben still wants to search Brandfetch to discover logos, but the URL must be captured to disk before being written to DB
- Do NOT touch Lucide icon names — bookmarks that reference a Lucide icon by name (e.g. `"Home"`, `"Server"`) must be left alone; only URL-shaped values migrate
- Do NOT introduce a new external image proxy service
- Do NOT force-push. Regular pushes only.

---

## Storage architecture (persistent volume, already in place)

Both servers already bind-mount an on-disk directory into the container:

| Server | Host path | Container path |
|--------|-----------|----------------|
| Abraham | `/Users/benny2168/Dockers/dashboard-uploads` | `/app/public/uploads` |
| MTCD Synology | (whatever the stack maps) | `/app/public/uploads` |

**AG must verify BOTH mounts exist before touching production.** If MTCD's mount is different, log the discrepancy and stop before running the migration on MTCD.

**File layout going forward:**

```
/app/public/uploads/
  icons/
    <sha256-hex-of-original-url-or-content>.<ext>
```

- Filename derived from a stable hash → same source URL becomes the same filename → **idempotent** (safe to re-run migration).
- Served under `/uploads/icons/<hash>.<ext>` — already routed by Next.js static file handler under `public/`.
- If a file already exists at the target path, DO NOT re-download; just point the DB row at it.

---

## Files AG will touch

1. **NEW: `src/lib/icon-storage.ts`** — reusable server-side helper
   Exports:
   - `downloadIconToDisk(sourceUrl: string): Promise<{ localPath: string; error?: string }>` — downloads a remote URL, validates it's an image (Content-Type sniff + magic-byte check for png/webp/svg/jpg/gif/ico), writes to `public/uploads/icons/<sha>.<ext>`, returns `/uploads/icons/<sha>.<ext>` OR an error object. 5 s fetch timeout. Max size 2 MB (reject larger). SVG must be sanitized (strip `<script>` and `on*` attributes; if AG doesn't want to hand-roll, add a minimal regex-based sanitize — fine for our threat model).
   - `saveBase64IconToDisk(dataUri: string): Promise<string | null>` — for cross-server ingest: takes `data:image/...;base64,....`, writes to the same disk path scheme, returns `/uploads/icons/<sha>.<ext>`.
   - `isExternalUrl(value: string | null | undefined): boolean` — helper. Returns true iff the string starts with `http://` or `https://` AND is not already pointing at the local server.
   - `isLucideIconName(value: string | null | undefined): boolean` — returns true iff the string looks like a Lucide icon name (starts with an uppercase letter, no slashes, no dots, no protocol).

2. **`src/components/IconPicker.tsx`** — when the user picks a Brandfetch icon (or pastes any URL), call `downloadIconToDisk` on the server BEFORE saving. Pass back the `/uploads/icons/...` path to the caller. Keep the search UX unchanged; only replace the value that's stored.
   - This means IconPicker needs a small server action wrapper (`downloadAndStoreIcon(url) → localPath`) exposed from `src/app/admin/actions.ts`.
   - On the ~11 use sites, they should already receive whatever IconPicker's `onChange` gives them, so no changes needed at the call sites if IconPicker just changes its output value.

3. **`src/app/admin/actions.ts`** — add:
   - `downloadAndStoreIcon(sourceUrl: string)` server action (thin wrapper around the lib).
   - In `refreshSyncedWorkspace` (around line 1263-1395): when ingesting a synced tab's payload, for every `icon` and `logoIcon` and `backgroundColor` field that arrives as a base64 data URI, call `saveBase64IconToDisk` and store the resulting `/uploads/icons/...` path in the DB. For any external URL that arrives, call `downloadIconToDisk` and store the local path (do NOT store the external URL).

4. **`src/app/api/sync/workspace/route.ts`** — the outbound sync route already base64-encodes local `/uploads/*` files. Extend `encodeMediaToBase64` so that any external `http(s)://` URL that survives (edge case — old data not yet migrated) is ALSO base64-encoded before being sent, using a 5 s fetch. This makes the receiver's job easy.

5. **NEW: `scripts/migrate-icons-to-disk.ts`** — one-shot migration script.
   - Reads all `Bookmark.icon`, `Section.icon`, `Tab.icon` values from the DB.
   - Filters to values where `isExternalUrl(v) === true` (skips Lucide names, skips already-`/uploads/*` paths).
   - For each unique external URL: downloads to disk via `downloadIconToDisk`, updates the DB row(s) that referenced it.
   - Logs per-row: `OK <table>.<id> "<title>" <old-url> -> <new-path>` or `FAIL <table>.<id> <error>`.
   - Failure policy: on download failure, set `icon = NULL` (fall through to default). Never leave a stale expired URL.
   - Runs idempotent — safe to re-run.
   - Runnable via `docker exec dashboard-app node scripts/migrate-icons-to-disk.js` (compile the .ts as part of build or ship as .mjs).
   - Prints a summary at the end: `Total processed: N | Downloaded: X | Skipped (already local): Y | Failed: Z`.

6. **`package.json`** — bump 1.11.2 → 1.12.0.

7. **Memory files** — update `change-tracker.md`, `notes-next-session.md`, `current-state.md`.

---

## Migration execution plan

The migration script must run on BOTH servers (they have independent DBs). Order:

1. Ship the code (v1.12.0) — new writes automatically self-host, existing rows unchanged.
2. Confirm v1.12.0 live on both `home.abraham16.com` and `home.server.mtcd.org` via the existing footer-poll.
3. Run migration on Abraham:
   `docker exec dashboard-app node /app/scripts/migrate-icons-to-disk.mjs`
4. Verify Abraham: count remaining rows where `icon` matches `^https?://` — expect ≤ a few (failed downloads).
5. Run migration on MTCD (via MTCD Portainer's `exec` endpoint or a direct SSH):
   `docker exec homedashboard-app node /app/scripts/migrate-icons-to-disk.mjs`
6. Verify MTCD.
7. Test one cross-server tab share (Ben will do this manually) — an old tab that had a brandfetch icon should now transfer with the icon as base64 → land as a local file on the receiver.

---

## Acceptance tests (AG must run before declaring done)

1. `npm run build` succeeds with zero TS errors.
2. Manually POST to the new server action `downloadAndStoreIcon` with a known-good Brandfetch URL → confirm file appears under `public/uploads/icons/` and returned path renders correctly.
3. Dry-run the migration script with `--dry-run` flag (add this flag) against the abraham DB → confirm output shows the 17 brandfetch + 103 jsdelivr rows queued.
4. Run the migration for real on abraham → verify the DB has zero brandfetch URLs remaining and zero jsdelivr URLs remaining.
5. Reload `home.abraham16.com` and time it. Expected: page renders in < 3 s (not 90 s).

---

## Rollback

- Code rollback: `git revert HEAD~<n>..HEAD` on both `main` and `abraham-prod`, push. Automatic redeploy.
- Migration rollback: not needed. The downloaded files stay under `public/uploads/icons/`; if AG accidentally NULLs the wrong rows, restore from Postgres nightly backup (if you keep one) or re-run the IconPicker manually per bookmark.
- **Before running the migration, AG must dump a full backup of the `Bookmark`, `Section`, and `Tab` tables to `/app/public/uploads/backups/pre-icon-migration-<timestamp>.sql`** on both servers.

---

## Safety rules AG must follow

1. Version-bump commit convention as in `change-tracker.md`.
2. Commit each logical unit separately (helper lib, IconPicker change, sync route change, migration script, memory updates).
3. Do NOT push until AG has run `npm run build` locally and it passed.
4. On any ambiguity, print `QUESTION:` and stop — do not guess.
5. The migration script is DESTRUCTIVE (rewrites DB `icon` values). It MUST default to `--dry-run` and require an explicit `--apply` flag to actually mutate the DB. Ben will run `--apply` himself after reviewing the dry-run output.
6. Never delete files under `public/uploads/`. The migration only ADDS to that dir.

---

## Deliverables AG must produce

- All code changes committed on `main` (not pushed).
- New file `scripts/migrate-icons-to-disk.mjs` executable.
- Updated memory files.
- A final summary printing: commit SHAs, files touched with +/- line counts, and the exact CLI incantations Ben will run on each server (dry-run first, then apply).
