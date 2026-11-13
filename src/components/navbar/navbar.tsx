import { Link } from '@tanstack/react-router'
import JoSuzukiAnimated from '~/components/home/josuzuki-animated'
import JoSuzuki from '~/components/josuzuki/josuzuki'
import NavigationLinks from '~/components/navigation-links/navigation-links'
import TopBarButtons from '~/components/top-bar-buttons/top-bar-buttons'

interface NavbarProps {
  /**
   * Home and the 404 page show the full name, typed back to "JoSuzuki"
   * (the legacy HomeNavbar); every other page shows "JoSuzuki".
   */
  animatedName?: boolean
  /** False on the 404 page, which had an empty nav list. */
  links?: boolean
}

const Navbar = ({ animatedName = false, links = true }: NavbarProps) => {
  return (
    <nav className="mx-auto max-w-container py-md">
      <div className="flex items-center justify-between">
        <Link to="/">{animatedName ? <JoSuzukiAnimated /> : <JoSuzuki />}</Link>
        <TopBarButtons />
      </div>
      <NavigationLinks links={links} />
    </nav>
  )
}

export default Navbar
