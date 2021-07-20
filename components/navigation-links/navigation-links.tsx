import Link from 'next/link'
import ThemeButton from '../theme-button/theme-button'
import usePagesContext from '../use-pages-context/use-pages-context'

const NavigationLinks = () => {
  const { navPages } = usePagesContext()

  return (
    <ul className="container">
      {navPages.map((navPage) => {
        const pageName = navPage.frontMatter?.title ?? navPage.name
        return (
          <li key={navPage.route}>
            <Link href={navPage.route}>
              <a
                className={`nav-link ${navPage.active ? 'nav-current' : ''}`}
                {...(navPage.active && { 'aria-current': 'page' })}
              >
                {pageName}
              </a>
            </Link>
          </li>
        )
      })}
      <li className="theme-button-container">
        <ThemeButton />
      </li>
      <style jsx>{`
        .container {
          display: flex;
          align-items: center;
        }
        .nav-current {
          color: var(--colors-accent);
          position: relative;
        }
        .nav-current:after {
          content: '';
          position: absolute;
          background-color: var(--colors-accent);
          bottom: -3px;
          right: -4px;
          left: -4px;
          height: 2px;
        }
        .nav-link {
          cursor: pointer;
          margin-left: var(--spaces-md);
          font-variation-settings: var(--font-weights-semibold);
        }
        .theme-button-container {
          margin-left: var(--spaces-md);
        }
      `}</style>
    </ul>
  )
}

export default NavigationLinks
