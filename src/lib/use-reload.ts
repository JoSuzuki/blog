import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

// One reload at a time, for the whole page. `router.invalidate()` normally
// resolves at once and reloads in the background, and a second one started
// meanwhile discards what the first was fetching. That happens for real: a
// login reloads every route and reconnects the socket, whose first event
// reloads the post's comments a moment later, and the page was left showing
// the old session. So each reload here waits for its loaders (`sync`), and
// the next one starts when it is done.
let queue: Promise<unknown> = Promise.resolve()

/** A reload that takes longer than this no longer holds up the next one. */
const RELOAD_TIMEOUT_MS = 10_000

/**
 * Returns the function that runs loaders again, which is how every page
 * here refreshes after an action or a live event (what Remix does by itself
 * after an action). With `routeIdPrefix` only the routes whose id starts
 * with it reload (`/posts/$slug`, `/games/santorini`); without, all of them.
 * The promise resolves when the loaders have run.
 */
export const useReload = (routeIdPrefix?: string) => {
  const router = useRouter()
  return useCallback((): Promise<void> => {
    const run = () => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, RELOAD_TIMEOUT_MS)
      })
      const reload = router.invalidate({
        sync: true,
        ...(routeIdPrefix === undefined
          ? {}
          : { filter: (match) => match.routeId.startsWith(routeIdPrefix) }),
      })
      // A failed reload leaves the page as it was; there is nothing for the
      // caller to do about it.
      return Promise.race([reload, timeout])
        .catch((error: unknown) => console.error('Reloading failed:', error))
        .finally(() => clearTimeout(timer))
    }
    const next = queue.then(run)
    queue = next
    return next
  }, [router, routeIdPrefix])
}
