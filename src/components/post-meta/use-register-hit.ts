import { useEffect, useState } from 'react'
import { registerHit } from '~/lib/hits/register-hit'

/**
 * Counts a page view and returns the route's new total (null until known, and
 * when counting fails). Like the legacy hook it runs from an effect, so
 * server-side rendering and crawlers that do not run JavaScript do not count,
 * and only in production builds, so development does not.
 */
const useRegisterHit = (route: string): number | null => {
  const [hits, setHits] = useState<number | null>(null)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let cancelled = false
    registerHit({ data: { route } })
      .then((result) => {
        if (!cancelled && typeof result.hits === 'number') setHits(result.hits)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [route])
  return hits
}

export default useRegisterHit
