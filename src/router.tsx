import { createRouter } from '@tanstack/react-router'
import {
  createIsomorphicFn,
  getGlobalStartContext,
} from '@tanstack/react-start'
import { routeTree } from './routeTree.gen'

// server.js generates a CSP nonce per request and passes it to Start's handler
// as `fetch(request, { context: { nonce } })`. getRouter runs inside that
// request's context, so the nonce reaches every script and style tag the
// router renders (HeadContent, Scripts, the hydration scripts). On the client
// the router reads it back from the <meta property="csp-nonce"> it emitted.
const getSsrOptions = createIsomorphicFn().server(() => {
  let nonce: string | undefined
  try {
    nonce = getGlobalStartContext()?.nonce
  } catch {
    // Outside a request's middleware context (no page render): no nonce.
  }
  return nonce ? { nonce } : undefined
})

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    ssr: getSsrOptions(),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
    server: { requestContext: { nonce?: string } }
  }
}
