# Abraham Dashboard — Fix HTML Bloat + Dedupe Bookmarks

## Test mode: DEPLOY-FIRST (this is a data migration on live abraham DB, not local)

## Problem (plain English)

Abraham's dashboard HTML is 59 MB per page load. Cause: 65 bookmarks have raw base64 icon images (some >3 MB each) stored directly in `Bookmark.icon`, totalling ~37 MB. Next.js serializes these into the initial HTML/RSC payload every request. Result: ~2.2 second document download, and the search input gets clobbered when hydration finishes.

There are also duplicate bookmark rows from earlier cross-server sync tests (`AV System Checklist` x3, most others x2). Cleaning these gives a smaller UI + lighter payload.

MTCD's HTML is normal-sized — this migration is abraham-only.

## Scope

**In scope:**
1. Convert 65 base64 icons on abraham to self-hosted files under `/app/public/uploads/`
2. Update `Bookmark.icon` to the `/api/uploads/<filename>.png` URL
3. Delete duplicate `Bookmark` rows on abraham (keep newest of each title/url pair)
4. Verify: new HTML size < 1 MB, TTFB unchanged, no broken icons in UI

**Not in scope:**
- No source code changes
- No git commits, no version bump, no push, no deploy
- MTCD DB — do NOT touch
- Do not run on MTCD (already clean)
- Do not touch `Section.icon` or `Tab.icon` — separate concern, only fix `Bookmark`

## Files to touch on the Mac

- Run existing script: `/Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/migrate-icons-to-disk.mjs` (from v1.12.0)
- Create new script: `/Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/dedupe-abraham-bookmarks.mjs`

## DB target

- Container: `dashboard-db` (abraham Mac Mini OrbStack, endpoint 3)
- DB URL: `postgresql://user:<pw>@dashboard-db:5432/dashboard` (inside the container network — the Next.js app already has `DATABASE_URL` set)
- Icon target path in container: `/app/public/uploads/` (bind-mounted to `/Users/benny2168/Dockers/dashboard-uploads` on host)
- URL prefix: `/api/uploads/<filename>` (matches v1.12.1 fix-icon-paths convention)

## Steps

### Phase 1 — Snapshot (mandatory)

```bash
# Backup the affected rows before touching anything
docker exec dashboard-db pg_dump -U user -d dashboard -t '"Bookmark"' \
  --data-only --column-inserts > /tmp/abraham-bookmark-backup-$(date +%Y%m%d-%H%M%S).sql
ls -lh /tmp/abraham-bookmark-backup-*.sql
```

Confirm backup file > 30 MB (it holds the base64 blobs).

### Phase 2 — Dry-run icon migration

Reuse existing script — it already handles the `Bookmark.icon` field and writes files to the upload path. Confirm it has a `--dry-run` flag; if not, read the script and stop for a corrective prompt.

```bash
cd /Users/benny2168/Antigravity/home-dashboard-mtcd
# Copy the script into the dashboard-app container so it can reach the DB via internal DNS
docker cp scripts/migrate-icons-to-disk.mjs dashboard-app:/tmp/migrate-icons-to-disk.mjs
docker exec dashboard-app node /tmp/migrate-icons-to-disk.mjs --dry-run 2>&1 | tail -40
```

Expected output: "would migrate 65 rows" (or similar). Print the tail.

If script doesn't support `--dry-run`, print a QUESTION and stop.

### Phase 3 — Apply icon migration

```bash
docker exec dashboard-app node /tmp/migrate-icons-to-disk.mjs 2>&1 | tail -40
```

Expected: 65 files written to `/app/public/uploads/`, 65 rows updated. Print the tail.

Verify:

```bash
docker exec dashboard-db psql -U user -d dashboard -tAc \
  "SELECT COUNT(*) FROM \"Bookmark\" WHERE icon LIKE 'data:image%';"
# Expect: 0
docker exec dashboard-db psql -U user -d dashboard -tAc \
  "SELECT COUNT(*) FROM \"Bookmark\" WHERE icon LIKE '/api/uploads/%';"
# Expect: >= 65 (previous self-hosted + new 65)
ls /Users/benny2168/Dockers/dashboard-uploads/ | wc -l
```

### Phase 4 — Dedupe dry-run

Write `scripts/dedupe-abraham-bookmarks.mjs` — a small Node script that:
- Uses Prisma or `pg` (whichever the existing scripts use)
- Groups `Bookmark` rows by `(title, url, sectionId)` — same three columns must match
- If a group has count > 1, keep the row with the newest `createdAt`, delete the rest
- Supports `--dry-run` (default) and `--apply`

Do NOT commit this script. It's a one-shot data cleanup. It can live in `scripts/` for now — we'll decide later whether to keep it.

```bash
docker cp scripts/dedupe-abraham-bookmarks.mjs dashboard-app:/tmp/dedupe.mjs
docker exec dashboard-app node /tmp/dedupe.mjs --dry-run 2>&1 | tail -60
```

Expected output: list of duplicate groups + which rows would be deleted. Should show ~25-30 rows to delete (65 bookmarks, ~20 unique titles, so 45-ish duplicates).

Stop here and print the dry-run summary. Do NOT apply yet — wait for a follow-up "apply" instruction if this runbook is dispatched separately.

**Actually — for this dispatch: apply after dry-run in the same run.** Ben approved the fix+dedupe combo. Just print dry-run first, then apply, back-to-back.

### Phase 5 — Apply dedupe

```bash
docker exec dashboard-app node /tmp/dedupe.mjs --apply 2>&1 | tail -60
```

Verify:

```bash
docker exec dashboard-db psql -U user -d dashboard -c \
  "SELECT title, COUNT(*) FROM \"Bookmark\" GROUP BY title HAVING COUNT(*) > 1 ORDER BY 2 DESC LIMIT 20;"
# Expect: empty or only intentional duplicates (different section, different url)
```

### Phase 6 — Verify page size drop

```bash
# Compare document size before/after (login page is a proxy; unauth users get 307 to login)
curl -sSk -o /dev/null -w "abraham /login: size=%{size_download} bytes\n" \
  -m 15 https://home.abraham16.com/login
# Also hit root — 307 redirect but we can measure the authenticated-flow size via a HEAD after login
```

Print the login page byte size. Real test is Ben reloading the dashboard in Edge — we'll do that afterward, but the login-page byte count is a sanity check that nothing broke.

### Phase 7 — Cleanup

```bash
docker exec dashboard-app rm -f /tmp/migrate-icons-to-disk.mjs /tmp/dedupe.mjs
```

Do NOT delete the backup at `/tmp/abraham-bookmark-backup-*.sql` on the host. Leave it for 7 days minimum.

## Acceptance criteria

1. `SELECT COUNT(*) FROM "Bookmark" WHERE icon LIKE 'data:image%'` returns `0`
2. All 65 previously-base64 bookmarks now have `icon` starting with `/api/uploads/`
3. Duplicate rows removed — no two `Bookmark` rows with same `(title, url, sectionId)`
4. Login page HTML size unchanged (should still be ~30 KB — login isn't affected)
5. Backup file exists at `/tmp/abraham-bookmark-backup-*.sql` and is > 30 MB
6. No errors in `docker logs dashboard-app --since 5m --tail 50`

## Rollback

```bash
# Nuclear rollback — restore Bookmark table from backup
docker exec -i dashboard-db psql -U user -d dashboard -c 'TRUNCATE "Bookmark" CASCADE;'
docker exec -i dashboard-db psql -U user -d dashboard < /tmp/abraham-bookmark-backup-<timestamp>.sql
```

(Cascade will drop bookmark-related joins; rollback is destructive to any bookmark-touching activity between now and rollback — should be zero minutes if we notice a problem immediately.)

## Fences

- Do NOT run on MTCD
- Do NOT touch `Section.icon`, `Tab.icon`, `Theme.*`
- Do NOT modify source code (no git commits, no push)
- Do NOT bump version
- Do NOT restart the dashboard-app container (not needed; Next.js re-reads DB on each request)
- If either script fails partway through, STOP and print the error — do not retry blindly

## Notify

At end, POST to `/notify`:

- Title: `Abraham dashboard cleanup done`
- Body: `Migrated N base64 icons, removed M duplicate bookmarks. Login page X KB. Reload in Edge to verify fast load.`
- Prio: `default`
