import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/feed.json')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { feedResponse } = await import('~/lib/feeds/feeds.server.ts')
        return feedResponse(request, 'json')
      },
    },
  },
})
