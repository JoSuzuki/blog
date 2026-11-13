import { createHash } from 'node:crypto'
import { Feed } from 'feed'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getPosts, loadPostBody } from '~/content/posts.ts'
import { absoluteUrl, getSiteOrigin } from '~/lib/site.ts'
import { createFeedComponents } from './feed-components.tsx'

export type FeedFormat = 'rss' | 'atom' | 'json'

export interface BuiltFeed {
  body: string
  etag: string
}

const FORMATS: Record<
  FeedFormat,
  { path: string; contentType: string; render: (feed: Feed) => string }
> = {
  rss: {
    path: '/feed.xml',
    contentType: 'application/rss+xml; charset=utf-8',
    render: (feed) => feed.rss2(),
  },
  atom: {
    path: '/atom.xml',
    contentType: 'application/atom+xml; charset=utf-8',
    render: (feed) => feed.atom1(),
  },
  json: {
    path: '/feed.json',
    contentType: 'application/feed+json; charset=utf-8',
    render: (feed) => feed.json1(),
  },
}

export const feedContentType = (format: FeedFormat) =>
  FORMATS[format].contentType

async function buildFeed(origin: string): Promise<Feed> {
  const toAbsolute = (url: string) => absoluteUrl(url, origin)
  const components = createFeedComponents(toAbsolute)
  const author = {
    name: 'Jonathan Suzuki',
    email: 'jonathan@suzuki.pro.br',
    link: origin,
  }

  // Newest first, secret posts excluded (the collection's default).
  const posts = getPosts()

  const feed = new Feed({
    title: 'JoSuzuki Blog',
    description:
      'Software engineer, smash bros player. Currently doing cool things with code.',
    id: origin,
    link: origin,
    language: 'pt-BR',
    favicon: toAbsolute('/favicon.ico'),
    copyright: 'All rights reserved 2021 - Present, Jonathan Suzuki',
    // Deterministic, so the output (and its ETag) only changes with content.
    updated: new Date(posts[0]?.date ?? 0),
    feedLinks: {
      rss: toAbsolute(FORMATS.rss.path),
      atom: toAbsolute(FORMATS.atom.path),
      json: toAbsolute(FORMATS.json.path),
    },
    author,
  })

  const bodies = await Promise.all(
    posts.map(async (post) => {
      const Body = await loadPostBody(post.slug)
      // React 19 hoists a <link rel="preload"> for every <img> to the front of
      // the markup. It means nothing outside a page head, so drop it.
      return renderToStaticMarkup(createElement(Body, { components })).replace(
        /^(<link rel="preload"[^>]*>)+/,
        '',
      )
    }),
  )

  posts.forEach((post, index) => {
    feed.addItem({
      title: post.title,
      // Kept exactly as the legacy feeds emitted it: subscribers' readers
      // recognise posts they have already seen by this identifier.
      id: post.route,
      link: toAbsolute(post.route),
      date: new Date(post.date),
      description: post.description,
      content: bodies[index],
      category: post.tags.map((name) => ({ name })),
      author: [{ name: post.author }],
    })
  })

  return feed
}

// One build per process and origin. The cache holds the promise, so concurrent
// first requests share one render, and a failed build is retried. In dev the
// content modules are re-evaluated when a post changes, and this module is
// re-evaluated with them, which empties the cache.
const cache = new Map<string, Promise<Record<FeedFormat, BuiltFeed>>>()

async function buildAll(origin: string) {
  const feed = await buildFeed(origin)
  const entries = (Object.keys(FORMATS) as FeedFormat[]).map((format) => {
    const body = FORMATS[format].render(feed)
    const etag = `"${createHash('sha1').update(body).digest('base64url')}"`
    return [format, { body, etag }] as const
  })
  return Object.fromEntries(entries) as Record<FeedFormat, BuiltFeed>
}

export async function getBuiltFeed(format: FeedFormat): Promise<BuiltFeed> {
  const origin = getSiteOrigin()
  let built = cache.get(origin)
  if (!built) {
    built = buildAll(origin)
    cache.set(origin, built)
    built.catch(() => cache.delete(origin))
  }
  return (await built)[format]
}

export async function feedResponse(
  request: Request,
  format: FeedFormat,
): Promise<Response> {
  const { body, etag } = await getBuiltFeed(format)
  const headers = {
    'Content-Type': FORMATS[format].contentType,
    'Cache-Control': import.meta.env.DEV
      ? 'no-cache'
      : 'public, max-age=600, stale-while-revalidate=3600',
    ETag: etag,
  }
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(body, { headers })
}
