import { getRouteApi } from '@tanstack/react-router'
import type { SessionState } from './get-session'

const rootRoute = getRouteApi('__root__')

/**
 * The session for components: who is logged in (`user`, null for a visitor)
 * and the Google client id. It is the root route's loader data, read on the
 * server during the page request, so the first paint already shows the right
 * reader. Nothing sets it from the browser: `login` and `logout` change the
 * cookie and then reload the loaders (see `useReload`).
 */
export const useSession = (): SessionState => rootRoute.useLoaderData()
