import { TabLinks } from '~/components/navigation-links/navigation-links'

const TABS = [
  { to: '/games/santorini', title: 'Salas', exact: true },
  { to: '/games/santorini/partidas', title: 'Partidas', exact: false },
] as const

/**
 * Switches between the rooms to play in and the games played, drawn like the
 * site's navigation (the active tab is underlined).
 */
const SantoriniTabs = () => (
  <nav className="mb-sm">
    <TabLinks links={TABS} label="Santorini" />
  </nav>
)

export default SantoriniTabs
