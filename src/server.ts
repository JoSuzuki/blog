// Custom server entry. Start uses src/server.ts in place of its default entry;
// the build bundles it into dist/server/server.js.
//
// The default export is Start's request handler: `{ fetch(request, opts) }`,
// which server.js calls for every request that is not a static file.
// The named export bundles the socket.io handlers into the same build so
// server.js can register them in production, the way mazeps exports `socket`
// from server/app.ts. In development server.js loads server/socket.ts through
// Vite directly instead, so it can reload it on change.
import handler from '@tanstack/react-start/server-entry'
import { reportSessionConfig } from './lib/auth/session-cookie.server'

export { registerSocketHandlers } from '../server/socket'

// One warning at startup if sessions cannot work (no usable
// IRON_SESSION_SECRET). The site still runs, logged out for everyone.
reportSessionConfig()

export default handler
