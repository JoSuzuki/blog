import { createFileRoute, notFound } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import QuizPlayer from '~/components/quiz/player'
import { getQuiz } from '~/lib/quiz/get-quiz'
import type { GetQuizResult } from '~/lib/quiz/get-quiz'
import { QUIZ_NAME } from '~/lib/quiz/quiz'

// The players' page: one page for the whole game. What it shows depends only
// on the game the loader returns and on what the socket pushes after it.
export const Route = createFileRoute('/games/quem-disse/')({
  loader: async () => {
    const result = await getQuiz().catch((): GetQuizResult => ({
      ok: false,
      reason: 'unavailable',
    }))
    // To anyone who may not play, this page does not exist.
    if (!result.ok && result.reason === 'not_found') throw notFound()
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
  component: QuizPage,
})

function QuizPage() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <h1>{QUIZ_NAME}</h1>
        {result.ok ? (
          <QuizPlayer loaded={result} />
        ) : (
          <p data-testid="quiz-unavailable">
            Não foi possível carregar o jogo agora.
          </p>
        )}
        <Footer />
      </Article>
    </>
  )
}
