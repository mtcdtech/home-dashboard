# Notes for Next Session: Home Dashboard

## Recommended Next Steps
1. **Post-Deployment Verification**:
   - Verify `v1.9.0` is deployed and live at `https://home.server.mtcd.org/`.
   - Test logging in via `authentik-pco`, `authentik-ms`, and `authentik-cc` to confirm `mtcdPersonId` is populated on the logged-in User row.
   - Navigate to `/admin/users` as an admin to inspect the new "IAM Link" column and verify the "Unlinked from IAM" filter chip.
2. **IAM Backfill Execution**:
   - Run dry-run backfill via Admin UI or `npm run backfill:iam` and review generated `backfill-report-*.csv`.
   - After confirming dry-run matches, execute `npm run backfill:iam:apply` (or click "Backfill IAM" in the Admin UI) to link legacy unlinked user rows.

## Open Questions & Future Phase D3 Track
- The admin portal Phase D3+E will add `home-dashboard` to `webapps.json` with an assigned `identity_profile` when `compat_mode` flipping is scheduled. No further code changes are needed in `home-dashboard` for Phase D3.
