# syntax=docker/dockerfile:1

# Node 22 LTS, matching CI. Alpine keeps the runtime image small.
ARG NODE_VERSION=22-alpine

# ── Dependencies ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# The lock file records optional native and wasm packages the way npm 11
# resolves them; npm 10, which node:22 still bundles, reads the same file and
# reports those entries as missing. Pinning the version keeps the image, CI and
# a developer machine reading one lock file the same way.
RUN npm install -g npm@11.6.2

# Only the manifests, so this layer is reused whenever they have not changed.
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined at build time, so mocking must be off here.
# MockProvider also keys on NODE_ENV, which makes shipping MSW impossible
# rather than merely unlikely — this is belt as well as braces.
ENV NEXT_PUBLIC_API_MOCKING=disabled
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runs unprivileged: a presentation layer has no reason to be root, and this
# container is reachable from nginx.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# `standalone` carries its own minimal node_modules and server.js. Static
# assets and public/ are not included in it and have to be copied separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# No HEALTHCHECK: the compose file and nginx own liveness for this service,
# and two sources of truth for "is it up" is how they disagree.
CMD ["node", "server.js"]
