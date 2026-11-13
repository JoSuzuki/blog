import crypto from 'node:crypto'
import { createServer } from 'node:http'
import path from 'node:path'
import compression from 'compression'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server } from 'socket.io'
import { NodeRequest, sendNodeResponse } from 'srvx/node'

// A variable, not a literal, so `tsc` does not try to type-check the build.
const BUILD_PATH = './dist/server/server.js'
const SERVER_ENTRY = '/src/server.ts'
const SOCKET_MODULE = '/server/socket.ts'
// Where app code finds the socket.io server (see src/lib/io.server.ts).
const IO_GLOBAL_KEY = '__blogSocketIO'

const DEVELOPMENT = process.env.NODE_ENV === 'development'
const PORT = Number.parseInt(process.env.PORT || '3000')
const ROOT = import.meta.dirname

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)
Object.assign(globalThis, { [IO_GLOBAL_KEY]: io })

/** @type {(() => void) | undefined} */
let disposeSocketHandlers
/** @type {unknown} */
let registeredSocketModule
/**
 * Swaps in a socket module: removes the previous module's handlers and
 * registers the new ones. A no-op when it is the same module instance.
 * @param {{ registerSocketHandlers: (io: Server) => () => void }} socketModule
 */
const installSocketModule = (socketModule) => {
  if (socketModule.registerSocketHandlers === registeredSocketModule) return
  disposeSocketHandlers?.()
  registeredSocketModule = socketModule.registerSocketHandlers
  disposeSocketHandlers = socketModule.registerSocketHandlers(io)
}

/**
 * Hands a request to TanStack Start's fetch handler (the default export of
 * src/server.ts) and writes its Response back. The CSP nonce generated below
 * travels as request context; src/router.tsx reads it.
 * @param {{ fetch: (request: Request, opts: { context: { nonce: string } }) => Response | Promise<Response> }} serverEntry
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const handleWithStart = async (serverEntry, req, res) => {
  const request = new NodeRequest({ req, res, trustProxy: true })
  const response = await serverEntry.fetch(request, {
    context: { nonce: res.locals.cspNonce },
  })
  await sendNodeResponse(res, response)
}

app.set('trust proxy', true)
app.disable('x-powered-by')

// Liveness for the platform's health check: answered before the HTTPS redirect
// and every other middleware, and it does not touch the database.
app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store').type('text/plain').send('ok')
})

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64')
  next()
})

app.use(compression())

// YouTube embeds refuse to play without a Referer, which helmet's default
// `no-referrer` would strip. Google Identity Services' popup needs
// `same-origin-allow-popups`.
const referrerPolicy = /** @type {const} */ ({
  policy: 'strict-origin-when-cross-origin',
})

/** @type {import('vite').ViteDevServer | undefined} */
let viteDevServer

if (DEVELOPMENT) {
  console.log('Starting development server')
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      referrerPolicy,
    }),
  )

  const vite = await import('vite')

  // The socket module is loaded through the same module runner as the app.
  // When a file in its import graph changes, the plugin below drops the
  // runner's copies of that graph and installs the re-imported module (the
  // previous handlers are disposed first). It runs in Vite's hotUpdate hook,
  // after Vite has invalidated the changed file and before it tells the
  // runner, so the re-import always sees the new code.
  /** @type {import('vite').RunnableDevEnvironment | undefined} */
  let ssrEnvironment
  const loadSocketModule = async () => {
    if (!ssrEnvironment) return
    installSocketModule(await ssrEnvironment.runner.import(SOCKET_MODULE))
  }
  /** @param {import('vite').RunnableDevEnvironment} environment */
  const socketModuleFiles = async (environment) => {
    /** @type {Set<string>} */
    const files = new Set()
    const entry = await environment.moduleGraph.getModuleByUrl(SOCKET_MODULE)
    /** @param {typeof entry} mod */
    const visit = (mod) => {
      if (!mod?.file || files.has(mod.file)) return
      files.add(mod.file)
      for (const imported of mod.importedModules) visit(imported)
    }
    visit(entry)
    return files
  }
  /** @type {import('vite').Plugin} */
  const socketReloadPlugin = {
    name: 'blog:socket-reload',
    async hotUpdate({ file }) {
      if (!ssrEnvironment || this.environment !== ssrEnvironment) return
      const files = await socketModuleFiles(ssrEnvironment)
      if (!files.has(file)) return
      const { evaluatedModules } = ssrEnvironment.runner
      for (const graphFile of files) {
        for (const mod of evaluatedModules.getModulesByFile(graphFile) ?? []) {
          evaluatedModules.invalidateModule(mod)
        }
      }
      try {
        await loadSocketModule()
        console.log('Reloaded the socket handlers')
      } catch (error) {
        if (error instanceof Error) viteDevServer?.ssrFixStacktrace(error)
        console.error('Could not reload the socket handlers:', error)
      }
    },
  }

  viteDevServer = await vite.createServer({
    // Vite's HMR websocket shares the HTTP server (and port) with socket.io;
    // each only answers upgrades on its own path.
    server: { middlewareMode: true, ws: { server: httpServer } },
    // Start's request handler below serves the HTML, not Vite.
    appType: 'custom',
    plugins: [socketReloadPlugin],
  })
  const devServer = viteDevServer
  const ssr = devServer.environments.ssr
  if (!ssr || !vite.isRunnableDevEnvironment(ssr)) {
    throw new Error('The ssr Vite environment cannot run modules')
  }
  ssrEnvironment = ssr
  const runner = ssr.runner
  await loadSocketModule()

  app.use(devServer.middlewares)
  app.use(async (req, res, next) => {
    try {
      const { default: serverEntry } = await runner.import(SERVER_ENTRY)
      await handleWithStart(serverEntry, req, res)
    } catch (error) {
      if (error instanceof Error) devServer.ssrFixStacktrace(error)
      next(error)
    }
  })
} else {
  console.log('Starting production server')

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // Every inline script carries this request's nonce.
            (req, res) =>
              `'nonce-${/** @type {import('express').Response} */ (res).locals.cspNonce}'`,
            'https://accounts.google.com/gsi/client',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://accounts.google.com/gsi/style',
          ],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          // 'self' covers same-origin ws:/wss: (CSP Level 3).
          connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
          frameSrc: [
            'https://www.youtube.com',
            'https://www.youtube-nocookie.com',
            'https://accounts.google.com/gsi/',
          ],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      referrerPolicy,
    }),
  )

  app.use((req, res, next) => {
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(req.hostname)
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https'
    if (!isLocalhost && !isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`)
    }
    next()
  })

  // Hashed build output: cache forever. A miss is a 404, not a page render.
  app.use(
    '/assets',
    express.static(path.join(ROOT, 'dist/client/assets'), {
      immutable: true,
      maxAge: '1y',
    }),
    (req, res) => res.sendStatus(404),
  )
  app.use(morgan('tiny'))
  // Everything copied from public/ (fonts, images, favicon): short cache.
  app.use(
    express.static(path.join(ROOT, 'dist/client'), {
      maxAge: '1h',
      index: false,
    }),
  )

  const build = await import(BUILD_PATH)
  installSocketModule(build)

  app.use(async (req, res, next) => {
    try {
      await handleWithStart(build.default, req, res)
    } catch (error) {
      next(error)
    }
  })
}

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

let shuttingDown = false
/** @param {NodeJS.Signals} signal */
const shutdown = async (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received, shutting down`)
  setTimeout(() => {
    console.error('Shutdown timed out, exiting')
    process.exit(1)
  }, 10_000).unref()
  disposeSocketHandlers?.()
  await viteDevServer?.close()
  // Disconnects every socket, then closes the HTTP server, which waits for
  // in-flight requests and drops idle keep-alive connections.
  io.close((error) => {
    if (error) console.error(error)
    process.exit(error ? 1 : 0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
