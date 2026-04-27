#!/bin/sh
set -e

# Apply Prisma schema to the database. Prefer `migrate deploy` when a
# migrations directory is present; otherwise fall back to `db push` to sync
# the schema (this repo ships without committed migrations).
if [ -d "./prisma/migrations" ] && [ -n "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --accept-data-loss
fi

# If extra args were passed (e.g. `npm run dev` from docker-compose), run them.
# Otherwise launch the Next.js standalone server produced by the production build.
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec node server.js
fi
