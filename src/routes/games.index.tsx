import { Link, createFileRoute } from '@tanstack/react-router'
import Article from '~/components/article/article'
import CommonLink from '~/components/common-link/common-link'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { canPlayQuiz } from '~/lib/auth/roles'
import { useSession } from '~/lib/auth/use-session'
import { QUIZ_NAME, QUIZ_PATH } from '~/lib/quiz/quiz'

const GAMES = [
  {
    to: '/games/santorini',
    name: 'Santorini',
    description:
      'Jogo de estratégia abstrata inspirado na mitologia grega. Construa e suba em torres para alcançar o terceiro nível.',
    details: '2 jogadores - 15 min - online',
  },
  {
    to: '/games/tabu',
    name: 'Tabu',
    description:
      'Faça seu time adivinhar a palavra sem dizer nenhuma das cinco proibidas. O outro time está de olho.',
    details: '4 a 16 jogadores em dois times - 10 a 30 min - online',
  },
] as const

// Only the readers who may play see this one. Hiding it is a convenience, not
// the protection: the game's pages, images and events check the role
// themselves.
const QUIZ = {
  to: QUIZ_PATH,
  name: QUIZ_NAME,
  description:
    'Um print de conversa com os nomes escondidos: adivinhe quem escreveu cada mensagem.',
  details: 'Em grupo -cada um no seu celular',
} as const

export const Route = createFileRoute('/games/')({
  head: () => ({ meta: [{ title: 'Games | JoSuzuki' }] }),
  component: Games,
})

function Games() {
  const { role } = useSession()
  const games = canPlayQuiz(role) ? [...GAMES, QUIZ] : GAMES
  return (
    <>
      <Navbar />
      <Article>
        <h1>Games</h1>
        <ul>
          {games.map((game) => (
            <li key={game.to} className="mb-md">
              <h3>
                <Link to={game.to}>{game.name}</Link>
              </h3>
              <p>
                {game.description}
                <span className="ml-sm">
                  <CommonLink href={game.to}>Jogar →</CommonLink>
                </span>
              </p>
              <div className="text-sm text-accent">{game.details}</div>
            </li>
          ))}
        </ul>
        <Footer />
      </Article>
    </>
  )
}
