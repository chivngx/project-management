# syntax=docker/dockerfile:1.7

# ---- Stage 1: deps ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable Bun for faster installs (optional). We use npm here for broad compat.
COPY package.json bun.lock* package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# ---- Stage 2: build ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client (uses the schema copied above).
RUN npx prisma generate
# Build Next.js (skips lint so the build doesn't fail on warnings).
RUN npm run build

# ---- Stage 3: runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Run as a non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed to run.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/package.json ./package.json

# SQLite DB will live in /app/db — mount a volume there in production.
RUN mkdir -p /app/db && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

# Apply migrations on startup (safe: no-op if already applied), then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
