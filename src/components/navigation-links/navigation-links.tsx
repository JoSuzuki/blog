import { Link } from '@tanstack/react-router'
import { isAdmin } from '~/lib/auth/roles'
import { useSession } from '~/lib/auth/use-session'

// The legacy theme collected these from the pages whose frontmatter type was
// `page`, `posts` or `customPage`, newest `date` first. Home is active only on
// `/`; Posts is active on `/posts` and on every post, and Games (new on this
// site) on `/games` and everything under it. TanStack's Link works
// that out from `activeOptions` and marks the active one with
// `aria-current="page"`, as the legacy markup did.
const NAV_PAGES = [
  { to: '/', title: 'Home', exact: true },
  { to: '/posts', title: 'Posts', exact: false },
  { to: '/games', title: 'Games', exact: false },
] as const

// Only admins see this one. Hiding it is a convenience, not the protection:
// the page's server functions check the role themselves.
const USERS_PAGE = { to: '/users', title: 'Users', exact: false } as const

const linkClassName =
  'cursor-pointer wght-semibold ' +
  'aria-[current=page]:relative aria-[current=page]:text-accent ' +
  'aria-[current=page]:after:absolute aria-[current=page]:after:-right-[4px] aria-[current=page]:after:-bottom-[3px] aria-[current=page]:after:-left-[4px] aria-[current=page]:after:h-[2px] aria-[current=page]:after:bg-accent'

interface NavigationLinksProps {
  /**
   * The 404 page was not wrapped by the legacy theme, so it had no nav pages
   * and rendered the list empty (it still takes up its padding).
   */
  links?: boolean
}

const NavigationLinks = ({ links = true }: NavigationLinksProps) => {
  const { role } = useSession()
  const pages = isAdmin(role) ? [...NAV_PAGES, USERS_PAGE] : NAV_PAGES
  return (
    <ul className="flex items-center gap-x-md overflow-auto py-sm">
      {links &&
        pages.map((page) => (
          <li key={page.to}>
            <Link
              to={page.to}
              activeOptions={{ exact: page.exact }}
              className={linkClassName}
            >
              {page.title}
            </Link>
          </li>
        ))}
    </ul>
  )
}

export default NavigationLinks
