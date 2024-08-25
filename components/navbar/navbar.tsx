import Link from 'next/link'
import JoSuzuki from '../josuzuki/josuzuki'
import NavigationLinks from '../navigation-links/navigation-links'
import TopBarButtons from '../top-bar-buttons/top-bar-buttons'

const Navbar = () => {
  return (
    <nav>
      <div className="header">
        <Link href="/">
          <a>
            <JoSuzuki />
          </a>
        </Link>
        <TopBarButtons />
      </div>
      <NavigationLinks />
      <style jsx>{`
        nav {
          padding: var(--spaces-md) 0;
          max-width: var(--container-max-width);
          margin-left: auto;
          margin-right: auto;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
      `}</style>
    </nav>
  )
}

export default Navbar
