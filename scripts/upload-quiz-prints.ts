// Uploads the quiz's prints (images and answers) into the database that
// DATABASE_URL points at. The material itself is private and lives outside
// the repository; this script only knows its shape:
//
//   manifest.json   { "prints": [ { "id": "001", "source": "<file name>",
//                     "width": n, "height": n, "status": "proposed" |
//                     "reviewed" | "excluded", "slots": [ { "label": "A",
//                     "person": "<name>" | null } ] } ] }
//   <censored>/<id>.png   the image with the names hidden
//   <originals>/<source>  the image as it was
//
// Usage (see the README, "Games: the quiz"):
//
//   npm run quiz:upload -- --manifest <manifest.json> --censored <dir> \
//     --originals <dir> [--include-proposed] [--dry-run] [--allow-remote]
//
// By default only `reviewed` prints whose slots all have a person from the
// game's list are uploaded; everything skipped is listed with the reason.
// `--include-proposed` also takes `proposed` ones (for local testing).
// A print is keyed by its manifest id, so running this again updates rows
// instead of duplicating them; prints missing from the manifest are left
// alone. A database that is not on this machine needs `--allow-remote`.
// Nothing about the prints is printed except their ids.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { PrismaPg } from '@prisma/adapter-pg'
import { z } from 'zod'
import { PrismaClient } from '../src/generated/prisma/client'
import { QUIZ_SLOT_PATTERN, isQuizPerson } from '../src/lib/quiz/quiz'

const manifestSchema = z.object({
  prints: z.array(
    z.object({
      // Used as a file name: nothing that could leave the directory.
      id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
      source: z.string().min(1),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      status: z.enum(['proposed', 'reviewed', 'excluded']),
      slots: z.array(
        z.object({ label: z.string(), person: z.string().nullable() }),
      ),
    }),
  ),
})

type ManifestPrint = z.infer<typeof manifestSchema>['prints'][number]

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const { values: args } = parseArgs({
  options: {
    manifest: { type: 'string' },
    censored: { type: 'string' },
    originals: { type: 'string' },
    'include-proposed': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'allow-remote': { type: 'boolean', default: false },
  },
})
const { manifest, censored, originals } = args
if (!manifest || !censored || !originals) {
  fail(
    'Usage: npm run quiz:upload -- --manifest <manifest.json> --censored <dir> ' +
      '--originals <dir> [--include-proposed] [--dry-run] [--allow-remote]',
  )
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) fail('DATABASE_URL is not set.')
const database = new URL(databaseUrl!)
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
  database.hostname,
)
// Never the credentials.
const target = `${database.hostname}:${database.port || 5432}${database.pathname}`
if (!local && !args['allow-remote'] && !args['dry-run']) {
  fail(
    `DATABASE_URL points at ${target}, which is not this machine. ` +
      'Pass --allow-remote if that is the database you mean.',
  )
}

const isImage = (bytes: Buffer) =>
  bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
  bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
  bytes.subarray(0, 4).toString('latin1') === 'RIFF'

const readImage = (file: string): Buffer | string => {
  let bytes: Buffer
  try {
    bytes = readFileSync(file)
  } catch {
    return 'file not found'
  }
  return isImage(bytes) ? bytes : 'not a PNG, JPEG or WebP image'
}

/** Why a print is not uploaded, or null if it is. */
const reasonToSkip = (print: ManifestPrint): string | null => {
  if (print.status === 'excluded') return 'excluded'
  if (print.status === 'proposed' && !args['include-proposed']) {
    return 'not reviewed yet (status "proposed"; see --include-proposed)'
  }
  if (print.slots.length === 0) return 'has no slots'
  const labels = print.slots.map((slot) => slot.label)
  if (labels.some((label) => !QUIZ_SLOT_PATTERN.test(label))) {
    return 'a slot label is not a single capital letter'
  }
  if (new Set(labels).size !== labels.length) return 'repeated slot label'
  if (print.slots.some((slot) => slot.person === null)) {
    return 'a slot has no person'
  }
  if (print.slots.some((slot) => !isQuizPerson(slot.person))) {
    return "a slot's person is not in the game's list (QUIZ_PEOPLE)"
  }
  return null
}

const main = async () => {
  const parsed = manifestSchema.safeParse(
    JSON.parse(readFileSync(manifest!, 'utf8')),
  )
  if (!parsed.success) {
    // The paths and codes of the problems, never the values.
    const problems = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `  ${issue.path.join('.')}: ${issue.code}`)
    return fail(
      `The manifest does not have the expected shape:\n${problems.join('\n')}`,
    )
  }
  const { prints } = parsed.data
  const ids = prints.map((print) => print.id)
  if (new Set(ids).size !== ids.length) fail('The manifest repeats a print id.')

  console.log(
    `${args['dry-run'] ? 'Dry run against' : 'Uploading to'} ${target}: ` +
      `${prints.length} prints in the manifest.`,
  )

  const prisma = args['dry-run']
    ? null
    : new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl }),
      })
  const skipped = new Map<string, string[]>()
  const skip = (id: string, reason: string) =>
    skipped.set(reason, [...(skipped.get(reason) ?? []), id])
  let created = 0
  let updated = 0

  try {
    for (const print of prints) {
      const reason = reasonToSkip(print)
      if (reason) {
        skip(print.id, reason)
        continue
      }
      const censoredImage = readImage(path.join(censored!, `${print.id}.png`))
      if (typeof censoredImage === 'string') {
        skip(print.id, `censored image: ${censoredImage}`)
        continue
      }
      // `source` is a file name inside the originals directory, nothing else.
      const originalImage = readImage(
        path.join(originals!, path.basename(print.source)),
      )
      if (typeof originalImage === 'string') {
        skip(print.id, `original image: ${originalImage}`)
        continue
      }
      if (censoredImage.equals(originalImage)) {
        skip(print.id, 'the censored image is identical to the original')
        continue
      }

      const data = {
        width: print.width,
        height: print.height,
        slots: print.slots.map((slot) => ({
          label: slot.label,
          person: slot.person,
        })),
      }
      const image = {
        censored: new Uint8Array(censoredImage),
        original: new Uint8Array(originalImage),
      }
      if (prisma) {
        const existing = await prisma.quizPrint.findUnique({
          where: { externalId: print.id },
          select: { id: true },
        })
        await prisma.quizPrint.upsert({
          where: { externalId: print.id },
          create: { externalId: print.id, ...data, image: { create: image } },
          update: {
            ...data,
            image: { upsert: { create: image, update: image } },
          },
          select: { id: true },
        })
        if (existing) updated += 1
        else created += 1
      } else {
        created += 1
      }
    }

    console.log(
      args['dry-run']
        ? `Would upload ${created} prints.`
        : `Uploaded ${created + updated} prints (${created} new, ${updated} updated).`,
    )
    const skippedCount = [...skipped.values()].reduce(
      (sum, list) => sum + list.length,
      0,
    )
    console.log(`Skipped ${skippedCount}.`)
    for (const [reason, list] of skipped) {
      console.log(`  ${reason}: ${list.length} (${list.join(', ')})`)
    }
    if (prisma) {
      const total = await prisma.quizPrint.count()
      console.log(`The database now has ${total} prints.`)
    }
  } finally {
    await prisma?.$disconnect()
  }
}

main().catch((error: unknown) => {
  // The message only: a stack or a query dump could quote a print.
  console.error(
    'Upload failed:',
    error instanceof Error ? error.message.slice(0, 300) : 'unknown error',
  )
  process.exit(1)
})
