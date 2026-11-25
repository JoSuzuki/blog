import { Link } from '@tanstack/react-router'

const TABS = [
  { key: 'salas', label: 'Salas', to: '/games/santorini' },
  { key: 'partidas', label: 'Partidas', to: '/games/santorini/partidas' },
] as const

/** Switches between the rooms to play in and the games played. */
const SantoriniTabs = ({
  current,
}: {
  current: (typeof TABS)[number]['key']
}) => (
  <nav aria-label="Santorini" className="mb-md flex border-b border-accent">
    {TABS.map((tab) =>
      tab.key === current ? (
        <span
          key={tab.key}
          aria-current="page"
          className="-mb-px border border-accent border-b-background bg-background px-md py-xs text-accent wght-bold"
        >
          {tab.label}
        </span>
      ) : (
        <Link
          key={tab.key}
          to={tab.to}
          className="px-md py-xs text-secondary underline"
        >
          {tab.label}
        </Link>
      ),
    )}
  </nav>
)

export default SantoriniTabs
