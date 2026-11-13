import type { ComponentProps, ReactNode } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import type { MDXComponents } from 'mdx/types'
import CenterImage from '~/components/center-image/center-image'
import CommonLink from '~/components/common-link/common-link'
import MdxImage from '~/components/mdx-image/mdx-image'
import Redacted from '~/components/redacted/redacted'
import VideoContainer from '~/components/video-container/video-container'
import { useAfterTitle } from './after-title'

const H1 = (props: ComponentProps<'h1'>) => {
  const afterTitle = useAfterTitle()
  return (
    <>
      <h1 {...props} />
      {afterTitle}
    </>
  )
}

// h2..h6 get a `slug` prop from rehypeHeadingSlugs (ids match the legacy
// theme's, quirks included). The id sits on an empty span before the link, as
// it did on the old site.
const heading =
  (Tag: 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
  ({ children, slug, ...props }: ComponentProps<'h2'> & { slug?: string }) => (
    <Tag {...props} className={Tag === 'h2' ? 'mt-lg mb-md' : undefined}>
      <span id={slug} />
      <a href={'#' + slug} className="group">
        {children}
        <span
          aria-hidden
          className="ml-sm text-secondary opacity-0 group-hover:opacity-100"
        >
          #
        </span>
      </a>
    </Tag>
  )

const Pre = (props: ComponentProps<'pre'>) => (
  <pre
    {...props}
    className="my-md overflow-x-auto bg-[#061526] p-md text-[0.875em] text-[#e2e8f0] shadow-[4px_4px_0_0_#3d6fa7]"
  />
)

const codeReset =
  'rounded-none border-0 bg-transparent p-0 font-[inherit] text-[length:inherit] leading-[inherit] font-normal text-inherit'

// Inline code and fenced code both arrive as `code` in MDX 3 (MDX 1 had a
// separate `inlineCode`). Fenced code carries a `language-*` class.
const Code = ({
  children,
  className,
  ...props
}: ComponentProps<'code'> & { children?: ReactNode }) => {
  if (!className?.startsWith('language-')) {
    return (
      <code
        {...props}
        className={className ?? 'rounded-[5px] bg-inline-code p-[3px]'}
      >
        {children}
      </code>
    )
  }
  const language = className.replace(/language-/, '')
  return (
    <Highlight
      code={String(children).trim()}
      language={language}
      theme={themes.nightOwl}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <code className={`${className} ${codeReset}`} style={{ ...style }}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </code>
      )}
    </Highlight>
  )
}

export const mdxComponents: MDXComponents = {
  h1: H1,
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  h5: heading('h5'),
  h6: heading('h6'),
  a: (({ href = '', ...props }: ComponentProps<'a'>) => (
    <CommonLink href={href} {...props} />
  )) as MDXComponents['a'],
  p: (props) => <p {...props} className="my-md" />,
  blockquote: (props) => (
    <blockquote
      {...props}
      className="border-l-[length:var(--spaces-xs)] border-solid border-secondary pl-md"
    />
  ),
  hr: (props) => <hr {...props} className="mt-xl mb-lg border-accent" />,
  ul: (props) => (
    <ul
      {...props}
      className="my-md list-none [&>li::before]:absolute [&>li::before]:top-[calc(0.875em-0.1875em)] [&>li::before]:left-[0.25em] [&>li::before]:size-[0.375em] [&>li::before]:rounded-full [&>li::before]:bg-secondary [&>li::before]:content-['']"
    />
  ),
  ol: (props) => (
    <ol
      {...props}
      className="my-md list-none [counter-reset:list-counter] [&>li]:[counter-increment:list-counter] [&>li::before]:absolute [&>li::before]:left-0 [&>li::before]:text-secondary [&>li::before]:content-[counter(list-counter)'.']"
    />
  ),
  li: (props) => (
    <li
      {...props}
      className="relative list-item pl-lg [text-align:-webkit-match-parent]"
    />
  ),
  pre: Pre,
  code: Code,
  table: (props) => (
    <table
      {...props}
      className="my-[2em] w-full table-auto text-left text-[0.875em]"
    />
  ),
  th: (props) => (
    <th
      {...props}
      className="border-b border-accent pr-sm pb-sm align-bottom font-semibold"
    />
  ),
  tr: (props) => (
    <tr {...props} className="border-b border-secondary last:border-b-0" />
  ),
  td: (props) => <td {...props} className="py-sm pr-md pl-0 align-top" />,
  Image: MdxImage,
  Redacted,
  CenterImage,
  VideoContainer,
}
