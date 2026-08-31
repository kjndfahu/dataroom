# Build context is the repository root, so the pnpm workspace lockfile is used.
#   docker build -f apps/web/Dockerfile .

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
WORKDIR /repo

# ── dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web... \
      --fetch-timeout 300000 --network-concurrency 4

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
# NEXT_PUBLIC_* values are inlined at build time, so they arrive as build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_MAX_FILE_SIZE=52428800
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MAX_FILE_SIZE=$NEXT_PUBLIC_MAX_FILE_SIZE
ENV NEXT_TELEMETRY_DISABLED=1

COPY apps/web apps/web
RUN pnpm --filter web build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /repo

# The standalone bundle carries its own node_modules, traced from the workspace.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static apps/web/.next/static
COPY --from=build /repo/apps/web/public apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
