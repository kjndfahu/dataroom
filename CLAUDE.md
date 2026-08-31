# Data Room — working notes

Monorepo: pnpm workspaces.

- `apps/web` — Next.js 16 (App Router, `src/`), React 19, Tailwind v4, shadcn/ui, TanStack Query, RHF + Zod.
- `apps/api` — NestJS 12 (ESM), Prisma 7 + PostgreSQL, S3-compatible storage, JWT auth.
- `apps/api/prisma` — schema, migrations, seed. Prisma 7 keeps connection URLs in `prisma.config.ts`
  and requires a driver adapter (`@prisma/adapter-pg`) at runtime; the generated client lives in
  `apps/api/generated/prisma` (gitignored).

Rules:
- Backend is authoritative for authorization — every resource lookup goes through the central
  authorization service. Never trust IDs or permissions coming from the client.
- Storage keys are generated (`dataroom/{dataRoomId}/{uuid}`), never derived from user filenames.
- Uploads go direct to storage via presigned URLs; the `File` row is created only after the upload
  is confirmed.
- Sharing is polymorphic (dataRoom | folder | file) with role `VIEWER` today; container shares grant
  the whole subtree at query time — no per-descendant rows.
