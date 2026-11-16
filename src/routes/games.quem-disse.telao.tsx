import { createFileRoute, notFound } from '@tanstack/react-router'
import Navbar from '~/components/navbar/navbar'
import QuizHost from '~/components/quiz/host'
import { getQuiz } from '~/lib/quiz/get-quiz'
import type { GetQuizResult } from '~/lib/quiz/get-quiz'
import { QUIZ_NAME } from '~/lib/quiz/quiz'

// The shared screen with the host's controls. Admins only: the events its
// buttons send are refused to anyone else anyway (see src/lib/quiz).
export const Route = createFileRoute('/games/quem-disse/telao')({
  loader: async () => {
    const result = await getQuiz().catch((): GetQuizResult => ({
      ok: false,
      reason: 'unavailable',
    }))
    // To anyone but a host, this page does not exist.
    if (result.ok ? !result.host : result.reason === 'not_found') {
      throw notFound()
    }
    return result
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${QUIZ_NAME} | JoSuzuki` },
          { name: 'robots', content: 'noindex' },
        ]
      : [],
  }),
  component: QuizHostPage,
})

function QuizHostPage() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      {/* Not an Article: the print gets the whole width of the screen. */}
      <main className="mx-auto w-full pb-xl">
        <h1 className="mb-md">{QUIZ_NAME}</h1>
        {result.ok ? (
          <QuizHost loaded={result} />
        ) : (
          <p data-testid="quiz-unavailable">
            Não foi possível carregar o jogo agora.
          </p>
        )}
      </main>
    </>
  )
}
