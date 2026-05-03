Things AG did fix
These are real improvements:

Upload path traversal hardening

/api/debug-auth removed

Dev credentials gated

Basic SSRF blocking for metadata, RFC1918, and loopback

Removed bad arguments[0] usage

Removed urlObj redeclaration

Fixed isPushedUser

Fixed setBackgroundColor

Locked-push enforcement now exists in both UI and server

Remaining non-blocking gaps
These are not merge blockers if the blockers above are fixed, but should be tracked:

SSRF guard does not block 100.64.0.0/10

SSRF guard does not block 198.18.0.0/15

MIME-type check exists but callers do not use it

UserContext.isLocalAdmin is typed but never populated

requireTabRole admin shortcut may bypass imported/read-only sync restrictions

What to tell AG
They need another fix pass. Minimum required before review:

Fix the four invalid "use server" placements.

Fix updateUserDefaultTab.

Remove secrets from abraham_stack.yml.

Rotate any exposed secrets.

Fix test imports so both test files run on a clean clone.

Add admin guards to theme ACL actions.

Re-run in a clean environment:

npm run build

node scratch/permissions.test.mjs

node scratch/security.test.mjs

Do not merge or deploy yet.