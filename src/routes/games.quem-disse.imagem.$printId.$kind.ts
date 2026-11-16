import { createFileRoute } from '@tanstack/react-router'

// The only way a print's image leaves the database. Who may get which image,
// and when, is in src/lib/quiz/image.server.ts.
export const Route = createFileRoute('/games/quem-disse/imagem/$printId/$kind')(
  {
    server: {
      handlers: {
        GET: async ({ params }) => {
          const { quizImageResponse } =
            await import('~/lib/quiz/image.server.ts')
          return quizImageResponse(params.printId, params.kind)
        },
      },
    },
  },
)
