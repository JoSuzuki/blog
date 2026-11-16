import { getCurrentUser } from '~/lib/auth/current-user.server'
import { canPlayQuiz } from '~/lib/auth/roles'
import { prisma } from '~/lib/db.server'
import { findPrintAccess } from './quiz.server'

// Every answer of this route, refusals included, may only be kept by the
// browser that asked and only for as long as it shows it: `no-store` keeps it
// out of shared proxies and out of the disk cache, so an image is never
// served to another reader, and a 404 from before the reveal is never served
// in place of the original after it. The two images of a print also have
// different addresses, so one can never be mistaken for the other.
const HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, noimageindex',
} as const

/** The same answer for every refusal, so that none tells what exists. */
const notFound = () =>
  new Response('Not Found', {
    status: 404,
    headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  })

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((byte, index) => bytes[index] === byte)

/** The type of an image from its first bytes (the upload accepts these). */
const imageType = (bytes: Uint8Array) =>
  startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])
    ? 'image/png'
    : startsWith(bytes, [0xff, 0xd8, 0xff])
      ? 'image/jpeg'
      : startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
        ? 'image/webp'
        : 'application/octet-stream'

/**
 * Answers `GET /games/quem-disse/imagem/$printId/$kind` (`kind` is
 * `censurada` or `original`). The only way an image leaves the database:
 * - the reader's role, read from the database now, must let them play;
 * - the censored image is served once the newest game has reached the print;
 * - the original only once that game has revealed it (see findPrintAccess).
 * Anything else is a 404, whatever the address.
 */
export const quizImageResponse = async (
  printIdParam: string,
  kind: string,
): Promise<Response> => {
  try {
    const user = await getCurrentUser()
    if (!user || !canPlayQuiz(user.role)) return notFound()
    if (!/^[1-9]\d{0,8}$/.test(printIdParam)) return notFound()
    if (kind !== 'censurada' && kind !== 'original') return notFound()
    const printId = Number(printIdParam)

    const access = await findPrintAccess(printId)
    const original = kind === 'original'
    if (!(original ? access.original : access.censored)) return notFound()

    const image = await prisma.quizPrintImage.findUnique({
      where: { printId },
      select: original ? { original: true } : { censored: true },
    })
    const bytes = image?.original ?? image?.censored
    if (!bytes) return notFound()

    return new Response(new Uint8Array(bytes), {
      headers: {
        ...HEADERS,
        'Content-Type': imageType(bytes),
        'Content-Length': String(bytes.byteLength),
      },
    })
  } catch (error) {
    console.error('Serving a quiz image failed:', error)
    return new Response('Service Unavailable', {
      status: 503,
      headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
