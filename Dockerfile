FROM node:22-alpine AS base

# Install all dependencies for builder
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install all dependencies based on package-lock.json
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Clean production dependencies only for runner image size optimization
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

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

# Build Next.js with cache mount
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache npx next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy complete production node_modules (pruned of dev tools, includes prisma CLI)
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

# Copy Prisma schema and scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

ENV PATH="/app/node_modules/.bin:${PATH}"

# Copy and prepare entrypoint
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Ensure the app directory is owned by nextjs
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 4000

ENV PORT=4000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
