import { Link } from '@tanstack/react-router'
import type { ComponentProps } from 'react'

interface CommonLinkProps extends ComponentProps<'a'> {
  href: string
}

const CommonLink = ({ href, children, ...props }: CommonLinkProps) => {
  const className = 'text-secondary underline'
  const isExternal = href.startsWith('https://') || href.startsWith('http://')
  if (isExternal) {
    return (
      <a
        target="_blank"
        rel="noopener"
        {...props}
        href={href}
        className={className}
      >
        {children}
      </a>
    )
  }
  return (
    <Link {...props} to={href} className={className}>
      {children}
    </Link>
  )
}

export default CommonLink
