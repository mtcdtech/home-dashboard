#!/bin/sh
set -e

echo "Starting Database Sync..."
if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma db push --accept-data-loss
else
  npx prisma db push --accept-data-loss
fi

# Use "$@" to preserve arguments, fallback to node server.js if none
if [ $# -eq 0 ]; then
  echo "Starting application with: node server.js"
  exec node server.js
else
  echo "Starting application with: $@"
  exec "$@"
fi
