import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '~/app.css?url'
import NotFound from '~/components/not-found/not-found'
import { RedactedProvider } from '~/components/redacted/redacted'
import { SessionProvider } from '~/components/session-provider/session-provider'
import { getSession } from '~/lib/auth/functions'

const meta = {
  title: 'JoSuzuki',
  description:
    'Software engineer, smash bros player. Currently doing cool things with code.',
}

// Runs before first paint. A full page load of the secret post without the
// reveal flag is sent to the 404 page, which remembers where to come back to.
const secretRedirectScript = `
(function(){
  const reveal = JSON.parse(localStorage.getItem('redacted'))
  if (location.pathname === "/posts/endings" && !reveal) {
    localStorage.setItem('secretRedirect', location.pathname);
    location.href = "/404"
  }
})()`

// Runs before first paint so the page never flashes in the wrong theme.
const themeScript = `
(function(){
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme && savedTheme !== 'null') {
    document.documentElement.setAttribute('data-theme', savedTheme)
  } else if (window.matchMedia) {
    const osTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    document.documentElement.setAttribute('data-theme', osTheme)
    localStorage.setItem('theme', osTheme)
  } else {
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')
  }
})()`

export const Route = createRootRoute({
  // The session is resolved on the server during the page request (a cookie
  // unseal, no database) and sent to the client with the page, so the top bar
  // renders the right button from the first paint. It runs once per document:
  // client-side navigations keep it, and login/logout update the provider.
  loader: async () => {
    try {
      return await getSession()
    } catch (error) {
      console.error('Reading the session failed:', error)
      return undefined
    }
  },
  staleTime: Infinity,
  shouldReload: false,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width' },
      { name: 'robots', content: 'follow, index' },
      { name: 'description', content: meta.description },
      { property: 'og:site_name', content: meta.title },
      { property: 'og:description', content: meta.description },
      { property: 'og:title', content: meta.title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@jo_suzuki' },
      { name: 'twitter:title', content: meta.title },
      { name: 'twitter:description', content: meta.description },
    ],
    links: [
      {
        rel: 'preload',
        href: '/fonts/Inter-roman.latin.var.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: '/fonts/space-grotesk.latin.var.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'RSS 2.0',
        href: '/feed.xml',
      },
      {
        rel: 'alternate',
        type: 'application/atom+xml',
        title: 'Atom 1.0',
        href: '/atom.xml',
      },
      {
        rel: 'alternate',
        type: 'application/feed+json',
        title: 'JSON Feed',
        href: '/feed.json',
      },
    ],
    scripts: [{ children: secretRedirectScript }, { children: themeScript }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  const sessionState = Route.useLoaderData()
  return (
    // The theme script sets data-theme on <html> before React hydrates it.
    <html lang="pt" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <SessionProvider initial={sessionState}>
          <RedactedProvider>{children}</RedactedProvider>
        </SessionProvider>
        <Scripts />
      </body>
    </html>
  )
}
