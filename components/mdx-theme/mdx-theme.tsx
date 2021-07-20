import ReactDOMServer from 'react-dom/server'
import {
  createContext,
  ReactElement,
  ReactNode,
  useContext,
  useMemo,
} from 'react'
import { MDXProvider, MDXProviderComponentsProp } from '@mdx-js/react'
import Slugger from 'github-slugger'
import React from 'react'
import Highlight, {
  defaultProps,
  Language,
  PrismTheme,
} from 'prism-react-renderer'
import nightOwl from 'prism-react-renderer/themes/nightOwl'
import styles from './mdx-theme.module.css'
import CommonLink from '../common-link/common-link'

function chanceOfSeeingTheSameSkin(numberOfSkinsSeen: number) {
  let p = (1.0 / 1251) ** numberOfSkinsSeen
  for (let i = 1252 - numberOfSkinsSeen; i < 1252; i++) {
    p *= i
  }
  return 1 - p
}

// Anchor links

const SluggerContext = createContext<Slugger>(null as unknown as Slugger)

const HeaderLink = ({
  tag: Tag,
  children,
  ...props
}: {
  tag: 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  children: ReactElement
}) => {
  const slugger = useContext(SluggerContext)
  const slug = slugger.slug(ReactDOMServer.renderToStaticMarkup(children) || '')
  return (
    <Tag {...props}>
      <span id={slug} />
      <a href={'#' + slug} className="subheading">
        {children}
        <span className="anchor-icon" aria-hidden>
          #
        </span>
      </a>
      <style jsx>{`
        .anchor-icon {
          opacity: 0;
          margin-left: var(--spaces-sm);
          color: var(--colors-secondary);
        }
        .subheading:hover .anchor-icon {
          opacity: 1;
        }
        h2 {
          margin-top: var(--spaces-lg);
          margin-bottom: var(--spaces-md);
        }
      `}</style>
    </Tag>
  )
}

const H2 = ({ children, ...props }: { children: ReactElement }) => {
  return (
    <HeaderLink tag="h2" {...props}>
      {children}
    </HeaderLink>
  )
}

const H3 = ({ children, ...props }: { children: ReactElement }) => {
  return (
    <HeaderLink tag="h3" {...props}>
      {children}
    </HeaderLink>
  )
}

const H4 = ({ children, ...props }: { children: ReactElement }) => {
  return (
    <HeaderLink tag="h4" {...props}>
      {children}
    </HeaderLink>
  )
}

const H5 = ({ children, ...props }: { children: ReactElement }) => {
  return (
    <HeaderLink tag="h5" {...props}>
      {children}
    </HeaderLink>
  )
}

const H6 = ({ children, ...props }: { children: ReactElement }) => {
  return (
    <HeaderLink tag="h6" {...props}>
      {children}
    </HeaderLink>
  )
}

const Pre = ({ children, ...rest }: { children: ReactElement }) => (
  <pre {...rest}>
    {children}
    <style jsx>{`
      pre {
        color: #e2e8f0;
        background-color: #061526;
        overflow-x: auto;
        font-size: 0.875em;
        margin-top: var(--spaces-md);
        margin-bottom: var(--spaces-md);
        padding: var(--spaces-md);
        box-shadow: 4px 4px 0px 0px #3d6fa7;
      }
    `}</style>
  </pre>
)

const Code = ({
  children,
  className,
  highlight,
  ...props
}: {
  children: string
  className: string
  highlight: string
}) => {
  const highlightedRanges = useMemo(() => {
    return highlight
      ? highlight.split(',').map((r) => {
          if (r.includes('-')) {
            return r.split('-').map((row) => Number(row))
          }
          return Number(r)
        })
      : []
  }, [highlight])

  if (!className) return <code {...props}>{children}</code>

  // https://mdxjs.com/guides/syntax-highlighting#all-together
  const language = className.replace(/language-/, '') as Language

  return (
    <Highlight
      {...defaultProps}
      code={children.trim()}
      language={language}
      theme={nightOwl}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <code className={className} style={{ ...style }}>
          {tokens.map((line, i) => (
            <div
              key={i}
              {...getLineProps({ line, key: i })}
              style={
                highlightedRanges.some((r) =>
                  Array.isArray(r)
                    ? r[0] <= i + 1 && i + 1 <= r[1]
                    : r === i + 1,
                )
                  ? {
                      background: 'rgb(29 10 53)',
                      margin: '0 -1rem',
                      padding: '0 1rem',
                    }
                  : undefined
              }
            >
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token, key })} />
              ))}
            </div>
          ))}
          <style jsx>{`
            code {
              background-color: transparent;
              border-width: 0;
              border-radius: 0;
              padding: 0;
              font-weight: 400;
              color: inherit;
              font-size: inherit;
              font-family: inherit;
              line-height: inherit;
            }
          `}</style>
        </code>
      )}
    </Highlight>
  )
}

const P = ({ children, ...rest }: { children: ReactElement }) => (
  <p {...rest}>
    {children}
    <style jsx>{`
      p {
        margin-top: var(--spaces-md);
        margin-bottom: var(--spaces-md);
      }
    `}</style>
  </p>
)

const Blockquote = ({ children, ...rest }: { children: ReactElement }) => (
  <blockquote {...rest}>
    {children}
    <style jsx>{`
      blockquote {
        border-left: solid var(--spaces-xs) var(--colors-secondary);
        padding-left: var(--spaces-md);
      }
    `}</style>
  </blockquote>
)

const HR = ({ ...props }) => (
  <>
    <hr {...props}></hr>
    <style jsx>{`
      hr {
        margin-top: var(--spaces-xl);
        margin-bottom: var(--spaces-lg);
        border-color: var(--colors-accent);
      }
    `}</style>
  </>
)

const UL = ({ children, ...rest }: { children: ReactElement }) => (
  <ul className={styles.ul} {...rest}>
    {children}
  </ul>
)

const OL = ({ children, ...rest }: { children: ReactElement }) => (
  <ol className={styles.ol} {...rest}>
    {children}
  </ol>
)

const LI = ({ children, ...rest }: { children: ReactElement }) => (
  <li className={styles.li} {...rest}>
    {children}
  </li>
)

const Table = ({ children, ...rest }: { children: ReactElement }) => (
  <table {...rest}>
    {children}
    <style jsx>{`
      table {
        width: 100%;
        table-layout: auto;
        text-align: left;
        margin-top: 2em;
        margin-bottom: 2em;
        font-size: 0.875em;
      }
    `}</style>
  </table>
)

const Th = ({ children, ...rest }: { children: ReactElement }) => (
  <th {...rest}>
    {children}
    <style jsx>{`
      th {
        font-weight: 600;
        border-bottom-width: 1px;
        border-bottom-color: var(--colors-accent);
        vertical-align: bottom;
        padding-bottom: var(--spaces-sm);
        padding-right: var(--spaces-sm);
      }
    `}</style>
  </th>
)

const Tr = ({ children, ...rest }: { children: ReactElement }) => (
  <tr {...rest}>
    {children}
    <style jsx>{`
      tr {
        border-bottom-width: 1px;
        border-bottom-color: var(--colors-secondary);
      }
      tr:last-child {
        border-bottom-width: 0px;
      }
    `}</style>
  </tr>
)

const Td = ({ children, ...rest }: { children: ReactElement }) => (
  <td {...rest}>
    {children}
    <style jsx>{`
      td {
        vertical-align: top;
        padding-top: var(--spaces-sm);
        padding-bottom: var(--spaces-sm);
        padding-left: 0px;
        padding-right: var(--spaces-md);
      }
    `}</style>
  </td>
)

const InlineCode = ({ children, ...rest }: { children: ReactElement }) => (
  <code {...rest}>
    {children}
    <style jsx>{`
      code {
        padding: 3px;
        border-radius: 5px;
        background-color: var(--colors-inline-code);
      }
    `}</style>
  </code>
)

const components: MDXProviderComponentsProp = {
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  a: CommonLink,
  code: Code,
  p: P,
  blockquote: Blockquote,
  hr: HR,
  ul: UL,
  ol: OL,
  li: LI,
  pre: Pre,
  table: Table,
  th: Th,
  tr: Tr,
  td: Td,
  inlineCode: InlineCode,
}

const MDXThemeWithSlugger = ({ children }: { children: ReactNode }) => {
  const slugger = new Slugger()
  return (
    <SluggerContext.Provider value={slugger}>
      <MDXProvider components={components}>{children}</MDXProvider>
    </SluggerContext.Provider>
  )
}

export default MDXThemeWithSlugger
