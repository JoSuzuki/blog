import { useRedactedContext } from '~/components/redacted/redacted'
import type { PostFilter } from '~/content/posts'

/**
 * Which posts the reader may see in lists, tag pages and previous/next: secret
 * posts join once the reveal flag is on. `reveal` is false on the server and
 * on the client's first render, and RedactedProvider reads localStorage in a
 * layout effect, so the server HTML always matches what hydration renders and
 * the lists switch before the first paint (as the legacy theme did).
 */
export const usePostFilter = (): PostFilter => {
  const { reveal } = useRedactedContext()
  return { includeSecret: Boolean(reveal) }
}
