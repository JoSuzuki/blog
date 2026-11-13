import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

// Server functions are same-origin RPC endpoints: refuse any request that the
// browser does not label as coming from this site (Sec-Fetch-Site, then
// Origin, then Referer), including requests that carry none of the three.
// Start applies this by default only while there is no start.ts, so it is
// stated here to keep it when other middleware (the session) is added.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))
