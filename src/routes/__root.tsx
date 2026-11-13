import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '~/app.css?url'
import { RedactedProvider } from '~/components/redacted/redacted'

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
        type: 'application/json',
        title: 'JSON Feed',
        href: '/feed.json',
      },
    ],
    scripts: [{ children: secretRedirectScript }, { children: themeScript }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme script sets data-theme on <html> before React hydrates it.
    <html lang="pt" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <RedactedProvider>{children}</RedactedProvider>
        <Scripts />
      </body>
    </html>
  )
}
