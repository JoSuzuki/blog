import Link from 'next/link'
import LoginButton from '../login-button/login-button'
import ThemeButton from '../theme-button/theme-button'
import usePagesContext from '../use-pages-context/use-pages-context'

const NavigationLinks = () => {
  const { navPages } = usePagesContext()

  return (
    <ul className="list">
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
      <style jsx>{`
        .list {
          display: flex;
          align-items: center;
          overflow: auto;
          padding-block: var(--spaces-sm);
          column-gap: var(--spaces-md);
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
          font-variation-settings: var(--font-weights-semibold);
        }
      `}</style>
    </ul>
  )
}

export default NavigationLinks
