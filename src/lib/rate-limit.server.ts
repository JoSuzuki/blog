export interface RateLimitOptions {
  /** Requests allowed per client within `windowMs`. */
  limit: number
  windowMs: number
  /** Most clients tracked at once; the oldest entries are dropped beyond it. */
  maxKeys: number
  now?: () => number
}

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterMs: number }

/**
 * Sliding-window limiter held in memory (the site runs as one process). Each
 * key keeps the timestamps of its hits inside the window, so memory is bounded
 * by `maxKeys * limit` numbers. A Map iterates in insertion order, and a key is
 * re-inserted on every use, so the first key is always the least recently used.
 */
export const createRateLimiter = ({
  limit,
  windowMs,
  maxKeys,
  now = Date.now,
}: RateLimitOptions) => {
  const hits = new Map<string, number[]>()

  const prune = (time: number) => {
    for (const [key, stamps] of hits) {
      // Newest hit last: if even that expired, the key is idle.
      if (stamps[stamps.length - 1] > time - windowMs) break
      hits.delete(key)
    }
  }

  return {
    /** Records an attempt for `key` unless it is over the limit. */
    take(key: string): RateLimitResult {
      const time = now()
      const stamps = (hits.get(key) ?? []).filter((t) => t > time - windowMs)
      if (stamps.length >= limit) {
        hits.delete(key)
        hits.set(key, stamps)
        return { allowed: false, retryAfterMs: stamps[0] + windowMs - time }
      }
      stamps.push(time)
      hits.delete(key)
      hits.set(key, stamps)
      if (hits.size > maxKeys) {
        prune(time)
        // Still over (a flood of distinct clients): drop the least recent.
        while (hits.size > maxKeys) {
          hits.delete(hits.keys().next().value as string)
        }
      }
      return { allowed: true }
    },
    /** For tests and diagnostics. */
    size: () => hits.size,
    reset: () => hits.clear(),
  }
}

type RateLimiter = ReturnType<typeof createRateLimiter>

const limiters = new Map<string, RateLimiter>()

/**
 * Counts one attempt by the request's client (see getClientKey) against the
 * limit called `name`, and says whether it is allowed. This is what actions
 * call. Each name has its own limiter, created with these options on first
 * use and kept in this module for the life of the process, so the caller
 * holds no state of its own.
 */
export const takeRateLimit = (
  name: string,
  request: Request,
  {
    limit,
    windowMs,
    maxKeys = 5000,
  }: Pick<RateLimitOptions, 'limit' | 'windowMs'> & { maxKeys?: number },
): RateLimitResult => {
  let limiter = limiters.get(name)
  if (!limiter) {
    limiter = createRateLimiter({ limit, windowMs, maxKeys })
    limiters.set(name, limiter)
  }
  return limiter.take(getClientKey(request))
}

/**
 * The address to rate limit on. The site is served behind one proxy (Fly),
 * which sets `Fly-Client-IP` itself, so a visitor cannot choose it. Otherwise
 * the last `X-Forwarded-For` entry is the one the nearest proxy appended (the
 * leftmost entries are whatever the client sent). With no proxy at all, the
 * socket's peer address.
 */
export const getClientKey = (request: Request): string => {
  const fly = request.headers.get('fly-client-ip')?.trim()
  if (fly) return fly
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim()
    if (last) return last
  }
  return (request as Request & { ip?: string }).ip || 'unknown'
}
