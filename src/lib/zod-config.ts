import { z } from 'zod'

// Zod compiles a faster parser for object schemas with `new Function`, after
// probing once whether eval is allowed. The site's CSP has no 'unsafe-eval',
// so in the browser the probe is blocked: Zod falls back to its normal parser
// anyway, but the browser logs (and reports) a CSP violation on every page.
// Turning the compiled parser off skips the probe. It has to run before the
// first schema is built, so router.tsx imports this module ahead of the
// route tree.
z.config({ jitless: true })
