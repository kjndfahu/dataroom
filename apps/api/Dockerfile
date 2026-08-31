# Build context is the repository root: the API is part of a pnpm workspace and
# needs the root lockfile to install deterministically.
#   docker build -f apps/api/Dockerfile .

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Prepare pnpm at build time; a container must never pause to download a
# package manager on boot.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
WORKDIR /repo

# ── dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
# Generous fetch settings: registry hiccups should not fail a deploy build.
RUN pnpm install --frozen-lockfile --filter api... \
      --fetch-timeout 300000 --network-concurrency 4

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY apps/api apps/api
# `prebuild` generates the Prisma client, then Nest compiles to dist/
RUN pnpm --filter api build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL, which the slim image does not ship.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/prisma.config.ts apps/api/
COPY --from=build /repo/apps/api/prisma apps/api/prisma

WORKDIR /repo/apps/api
EXPOSE 4000

# Migrations run on boot so a deploy can never serve a schema it does not have.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
