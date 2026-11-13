import type { ComponentProps, ReactNode } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import type { MDXComponents } from 'mdx/types'

// The components map used to render a post to static HTML for feed readers.
// It mirrors the site's map (`~/components/mdx/mdx-components`) minus
// everything that only makes sense on the site: no class names or Tailwind,
// no heading anchors, no Redacted popup, and every URL a reader may follow is
// absolute. Elements not listed render as the plain HTML tag.

const plainHeading =
  (Tag: 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
  ({ children }: { children?: ReactNode }) => <Tag>{children}</Tag>

type ImageProps = {
  src: string
  alt?: string
  width?: number
  height?: number
}

export const createFeedComponents = (
  toAbsolute: (url: string) => string,
): MDXComponents => {
  const Image = ({ src, alt, width, height }: ImageProps) => (
    <img src={toAbsolute(src)} alt={alt ?? ''} width={width} height={height} />
  )

  return {
    h2: plainHeading('h2'),
    h3: plainHeading('h3'),
    h4: plainHeading('h4'),
    h5: plainHeading('h5'),
    h6: plainHeading('h6'),
    a: ({ href = '', children }: ComponentProps<'a'>) => (
      <a href={href.startsWith('#') ? href : toAbsolute(href)}>{children}</a>
    ),
    code: ({ children, className }: ComponentProps<'code'>) => {
      if (!className?.startsWith('language-')) return <code>{children}</code>
      const theme = themes.nightOwl
      return (
        <Highlight
          code={String(children).trim()}
          language={className.replace(/language-/, '')}
          theme={theme}
        >
          {({ tokens, getLineProps, getTokenProps }) => (
            <code
              style={{
                display: 'block',
                overflowX: 'auto',
                padding: '1em',
                ...theme.plain,
              }}
            >
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
    },
    // The visible word only. The popup text is "redacted" until a reader turns
    // reveal on (which feeds cannot), and the hidden text is never rendered.
    Redacted: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Image,
    CenterImage: (props: ImageProps) => (
      <div style={{ textAlign: 'center' }}>
        <Image {...props} />
      </div>
    ),
    VideoContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
  }
}
