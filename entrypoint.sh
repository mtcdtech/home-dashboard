#!/bin/sh
set -e

echo "Starting Database Sync..."
# We skip generate because it's already done in the Docker build
npx prisma db push --accept-data-loss

# Use "$@" to preserve arguments, fallback to node server.js if none
if [ $# -eq 0 ]; then
  echo "Starting application with: node server.js"
  exec node server.js
else
  echo "Starting application with: $@"
  exec "$@"
fi
