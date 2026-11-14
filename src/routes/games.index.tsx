import { Link, createFileRoute } from '@tanstack/react-router'
import Article from '~/components/article/article'
import CommonLink from '~/components/common-link/common-link'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'

const GAMES = [
  {
    to: '/games/santorini',
    name: 'Santorini',
    description:
      'Jogo de estratégia abstrata inspirado na mitologia grega. Construa e suba em torres para alcançar o terceiro nível.',
    details: '2 jogadores - ~15 min - online',
  },
] as const

export const Route = createFileRoute('/games/')({
  head: () => ({ meta: [{ title: 'Games | JoSuzuki' }] }),
  component: Games,
})

function Games() {
  return (
    <>
      <Navbar />
      <Article>
        <h1>Games</h1>
        <ul>
          {GAMES.map((game) => (
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
