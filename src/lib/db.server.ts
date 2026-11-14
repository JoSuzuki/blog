import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '~/generated/prisma/client'

// Server code only (the `.server` suffix keeps it out of the client bundle).
//
// One client per process, kept on globalThis: in development the module can be
// re-evaluated by Vite's module runner on every edit, and each evaluation would
// otherwise open a new connection pool.
const globalForPrisma = globalThis as unknown as { __blogPrisma?: PrismaClient }

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

export const prisma = (globalForPrisma.__blogPrisma ??= createClient())
