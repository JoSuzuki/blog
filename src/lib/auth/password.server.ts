import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'

// Password hashing with Node's built-in scrypt, so there is no native
// dependency (mazeps used bcrypt). A stored hash is
// `scrypt$<N>$<r>$<p>$<salt>$<key>`, salt and key in base64url, so the cost
// can be raised later without breaking existing hashes: each hash is checked
// with the parameters it was made with.

/**
 * One of OWASP's equivalent scrypt settings (N = 2^15, r = 8, p = 3): 32 MB
 * per hash rather than the 128 MB of N = 2^17, since the site runs on a
 * 512 MB machine and logins can arrive together.
 */
const COST = { N: 2 ** 15, r: 8, p: 3 }
const KEY_LENGTH = 32
const SALT_LENGTH = 16

const derive = (
  password: string,
  salt: Buffer,
  { N, r, p }: { N: number; r: number; p: number },
  keyLength: number,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r }
    scrypt(
      password.normalize('NFKC'),
      salt,
      keyLength,
      options,
      (error, key) => (error ? reject(error) : resolve(key)),
    )
  })

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt, COST, KEY_LENGTH)
  return [
    'scrypt',
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

/** False for a wrong password and for anything that is not a hash of ours. */
export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [scheme, n, r, p, salt, key] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !key) return false
  const cost = { N: Number(n), r: Number(r), p: Number(p) }
  if (![cost.N, cost.r, cost.p].every(Number.isSafeInteger)) return false
  const expected = Buffer.from(key, 'base64url')
  if (expected.length === 0) return false
  try {
    const actual = await derive(
      password,
      Buffer.from(salt, 'base64url'),
      cost,
      expected.length,
    )
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | null = null

/**
 * Spends as long as a real check, for an email with no password, so the
 * answer's timing does not tell which emails have an account.
 */
export const verifyNothing = async (password: string): Promise<void> => {
  await verifyPassword(password, await (dummyHash ??= hashPassword('dummy')))
}
