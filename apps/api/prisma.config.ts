import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrate needs a direct (non-pooled) connection; fall back to DATABASE_URL locally.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
