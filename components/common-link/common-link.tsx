import Link from 'next/link'
import { ReactNode } from 'react'

interface CommonLinkProps {
  openInNewTab?: boolean
  children: ReactNode
  href: string
}

const CommonLink = ({ children, ...props }: CommonLinkProps) => {
  const isExternal =
    props.href &&
    (props.href.startsWith('https://') || props.href.startsWith('http://'))
  if (isExternal) {
    return (
      <a target="_blank" rel="noopener" {...props}>
        {children}
        <style jsx>{`
          a {
            text-decoration: underline;
            color: var(--colors-secondary);
          }
        `}</style>
      </a>
    )
  }
  return (
    <Link href={props.href}>
      <a {...props}>
        {children}
        <style jsx>{`
          a {
            text-decoration: underline;
            color: var(--colors-secondary);
          }
        `}</style>
      </a>
    </Link>
  )
}
export default CommonLink
