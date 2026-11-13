const DEFAULT_ORIGIN = 'https://josuzuki.me'

/**
 * The site's public origin, without a trailing slash. It comes from the
 * `SITE_URL` environment variable and is read on every call, so tests and the
 * deploy environment can set it after startup. This is the only place that
 * knows the production hostname.
 */
export const getSiteOrigin = (): string =>
  (process.env.SITE_URL?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, '')

/** Resolves a root-relative path (or leaves an absolute URL alone). */
export const absoluteUrl = (pathOrUrl: string, origin = getSiteOrigin()) =>
  /^[a-z][a-z0-9+.-]*:/i.test(pathOrUrl) || pathOrUrl.startsWith('//')
    ? pathOrUrl
    : origin + (pathOrUrl.startsWith('/') ? '' : '/') + pathOrUrl
