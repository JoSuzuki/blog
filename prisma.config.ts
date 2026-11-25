import { defineConfig } from 'prisma/config'

// Prisma 7 reads its settings from here, not from schema.prisma or
// package.json, and no longer loads `.env` on its own. Real environment
// variables win over the file; in production there is no file.
try {
  process.loadEnvFile()
} catch {
  // No .env: the environment provides the variables.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file-if-exists=.env prisma/seed.ts',
  },
  // What the CLI connects with (`prisma migrate`, `prisma db seed`): the
  // direct connection, which bypasses a pooler. The app itself connects
  // through its driver adapter with DATABASE_URL (src/lib/db.server.ts).
  // Read with process.env, not Prisma's `env()`, which throws when the
  // variable is missing: `prisma generate` (postinstall, the Docker build)
  // runs without a database.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
})
