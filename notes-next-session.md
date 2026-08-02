# Notes for Next Session: Home Dashboard

## Recommended Next Steps
1. **Post-Deployment Verification**:
   - Verify `v1.10.0` is deployed and live at `https://home.server.mtcd.org/`.
   - Verify the login button on the login screen says **"Log in Securely"**.
   - Test logging in via Authentik as an administrator (e.g. `tech@mtcd.org` / `ben@abraham16.com` or `avcoordinator@mtcd.org`) and verify you are granted admin permissions in the home dashboard (you have access to `/admin` routes).
   - Navigate to `/admin/users` and verify:
     - The warning note is visible: *"Administrator status is read-only in the webapp. Changing admin status is done in the MTCD Admin Portal."*
     - The admin switches in the user table are replaced with read-only badges ("Admin" / "Standard") and are not clickable.
     - Attempting to toggle admin status (by intercepting API or checking action code) fails with: *"Admin role changes must be performed in the MTCD Admin Portal."*
2. **Synchronize Authentik Groups**:
   - Log in to the MTCD Admin Portal (`https://admin.server.mtcd.org`) and check the `homedashboard` webapp config to verify the roles list shows only "Administrator" (`admin`) and "Standard User" (`standard`).
   - Check that `avcoordinator@mtcd.org`, `ben@abraham16.com`, and `webmaster@mtcd.org` are in the "Administrator" assignments list.
   - Click the sync button or ensure that the hourly sync cron synchronizes these assignments into the Authentik groups.

