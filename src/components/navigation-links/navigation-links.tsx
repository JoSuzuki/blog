import { Link } from '@tanstack/react-router'

// The legacy theme collected these from the pages whose frontmatter type was
// `page`, `posts` or `customPage`, newest `date` first. Home is active only on
// `/`; Posts is active on `/posts` and on every post. TanStack's Link works
// that out from `activeOptions` and marks the active one with
// `aria-current="page"`, as the legacy markup did.
const NAV_PAGES = [
  { to: '/', title: 'Home', exact: true },
  { to: '/posts', title: 'Posts', exact: false },
] as const

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
  return (
    <ul className="flex items-center gap-x-md overflow-auto py-sm">
      {links &&
        NAV_PAGES.map((page) => (
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
