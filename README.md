# Data Room

Secure virtual data room — folders, PDF uploads, previews, and sharing via public links or per-user permissioned shares.

> 🚧 Scaffolding stage. Full documentation (architecture, ERD, scaling, deployment) lands as the app is built.

## Structure

```
.
├── apps/
│   ├── web/        Next.js + React + Tailwind + shadcn/ui
│   └── api/        NestJS + Prisma + PostgreSQL
├── packages/       shared types (added when needed)
└── .env.example
```

## Local setup

```bash
pnpm install
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:4000
