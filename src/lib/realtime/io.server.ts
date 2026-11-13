import type { IOServer } from './events'

// server.js stores the socket.io server here when it creates it. This must be
// a globalThis slot, not a module variable: app code runs inside Vite's module
// runner in development and inside the bundled server build in production,
// so it never shares a module instance with anything server.js imports.
// Keep the name in sync with IO_GLOBAL_KEY in server.js.
declare global {
  var __blogSocketIO: IOServer | undefined
}

/**
 * The process's socket.io server, for server functions, server routes and
 * other server-only code. Throws when the app is not running under server.js
 * (for example under bare `vite dev`), where no socket.io server exists.
 */
export function getIO(): IOServer {
  const io = globalThis.__blogSocketIO
  if (!io) {
    throw new Error(
      'getIO(): no socket.io server. It is created by server.js; run the app ' +
        'with `npm run dev` or `npm start`, not with `vite dev` or `vite preview`.',
    )
  }
  return io
}
