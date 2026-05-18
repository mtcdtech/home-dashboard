FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm install

# Intermediate stage for development
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NODE_ENV=development
ENV PORT=4000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["./entrypoint.sh"]

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (needs a dummy DB URL for schema parsing)
ENV DATABASE_URL=postgresql://user:password@localhost:5432/dashboard

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Prisma CLI for migration at runtime
RUN apk add --no-cache libc6-compat
RUN npm install prisma@7.6.0 effect

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and CLI for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy and prepare entrypoint
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Ensure the app directory is owned by nextjs
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 4000

ENV PORT=4000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
LABEL build_time="Wed Apr 22 12:45:07 CDT 2026"
LABEL build_time_2="Wed Apr 22 12:47:55 CDT 2026"
LABEL build_time_3="Wed Apr 22 12:56:11 CDT 2026"
LABEL build_time_4="Wed Apr 22 13:22:29 CDT 2026"
LABEL build_time_5="Wed Apr 22 13:36:20 CDT 2026"
LABEL build_time_6="Wed Apr 22 13:48:27 CDT 2026"
