// Imports the FaunaDB backups (backup-comments.json, backup-hits.json) into
// Postgres. Safe to run any number of times:
// - a comment is keyed by its Fauna id and is never updated or duplicated;
// - a counter is only ever raised to the backup's value (GREATEST), so counts
//   gained since the first import survive a re-seed.
// Run with `npm run db:seed` (or `npx prisma db seed`).
import { readFileSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

interface BackupComment {
  id: string
  name: string
  comment: string
  route: string
  /** Milliseconds since the epoch. Fauna's own `timestamp` is not used. */
  createdAt: number
}

interface BackupHit {
  route: string
  hits: number
}

const readBackup = <T>(file: string): T =>
  JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const seedComments = async () => {
  const comments = readBackup<BackupComment[]>('backup-comments.json')
  for (const c of comments) {
    await prisma.comment.upsert({
      where: { faunaId: c.id },
      update: {},
      create: {
        faunaId: c.id,
        route: c.route,
        name: c.name,
        comment: c.comment,
        createdAt: new Date(c.createdAt),
      },
    })
  }
  return comments.length
}

const seedHits = async () => {
  // The backup has two documents for /posts/endings (63 and 0); a route has
  // one counter, so keep the highest.
  const byRoute = new Map<string, number>()
  for (const h of readBackup<BackupHit[]>('backup-hits.json')) {
    byRoute.set(h.route, Math.max(byRoute.get(h.route) ?? 0, h.hits))
  }
  for (const [route, hits] of byRoute) {
    await prisma.$executeRaw`
      INSERT INTO "HitCounter" ("route", "hits") VALUES (${route}, ${hits})
      ON CONFLICT ("route") DO UPDATE
      SET "hits" = GREATEST("HitCounter"."hits", EXCLUDED."hits")`
  }
  return byRoute.size
}

try {
  const comments = await seedComments()
  const counters = await seedHits()
  console.log(
    `Seeded ${comments} comments and ${counters} hit counters ` +
      `(now ${await prisma.comment.count()} comments, ${await prisma.hitCounter.count()} counters in the database).`,
  )
} finally {
  await prisma.$disconnect()
}
