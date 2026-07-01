# Handoff Notes - Authentik SSO Integration

You are picking up from a session where we integrated the Authentik SSO providers (Microsoft, Planning Center, and Church Center) with identity merging hierarchy (MS first, then PCO, then CC).

All of the code changes have already been written to the files! However, because the current machine was accessing the files over a slow SMB network mount, and suffered a disconnection, we were waiting a long time for `npm install` to repair `node_modules` before running the database migrations.

Below is the state of the codebase and the exact next steps to complete the task.

---

## Current Status

* **Code Changes:** **Completed.** All TypeScript, CSS, Next.js page components, logo SVGs, and docker configs are already modified.
* **Git Status:** 
  * Modified: `docker-compose.prod.yml`, `docker-compose.yml`, `package.json`, `prisma/schema.prisma`, `src/app/login/LoginForm.tsx`, `src/app/login/page.tsx`, `src/auth.config.ts`, `src/auth.ts`, `update_portainer.py`
  * Untracked: `public/brand/church-center.svg`
* **Remaining Work:** Packages need to be installed, the database schema needs to be updated with the new columns, and the build needs to be verified.

---

## Quick Steps to Finish

When you open this project on the network machine, run these commands in the terminal from the `homedashboard` root folder:

### 1. Reinstall Packages (Local filesystem speed)
Run the following to verify and install all dependencies:
```bash
npm install --no-audit --no-fund
```

### 2. Update the Database Schema
This updates the Postgres database schema to include the new identity fields (`msName`, `pcoName`, `ccName`, etc.):
```bash
npx prisma db push
```

### 3. Verify the Project Builds
Verify that there are no compile-time TypeScript errors with the new changes:
```bash
npm run build
```

### 4. Deploy the Stack to Portainer
Run the script to deploy the updated configuration to Stack 58 (MTCD instance):
```bash
python3 update_portainer.py
```

*Note: Make sure that the environment variables `AUTHENTIK_CC_CLIENT_ID`, `AUTHENTIK_CC_CLIENT_SECRET`, and `AUTHENTIK_CC_ISSUER` are correctly defined in your `.env` file before executing.*
