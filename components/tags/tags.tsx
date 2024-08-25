import { useRouter } from 'next/dist/client/router'
import Link from 'next/link'

export const TagName = () => {
  const { tag } = useRouter().query

  return (
    <span>
      {tag}
      <style jsx>{`
        span {
          padding-right: var(--spaces-xs);
          padding-left: var(--spaces-xs);
          color: var(--colors-accent);
          border: solid 1px var(--colors-accent);
          line-height: 1.2;
          background-color: var(--colors-accent-background);
          box-shadow: 3px 3px 0 0 var(--colors-accent);
          font-size: var(--font-sizes-lg);
          font-variation-settings: var(--font-weights-bold);
          margin-right: var(--spaces-xs);
        }
      `}</style>
    </span>
  )
}

const Tag = ({ children }: { children: string }) => {
  return (
    <Link href="/tags/[tag]" as={`/tags/${children}`}>
      <a>
        {children}
        <style jsx>{`
          a {
            display: flex;
            padding-right: var(--spaces-xs);
            padding-left: var(--spaces-xs);
            color: var(--colors-accent);
            border: solid 1px var(--colors-accent);
            line-height: 1.2;
            background-color: var(--colors-accent-background);
            box-shadow: 1px 1px 0 0 var(--colors-accent);
            position: relative;
          }
          a:hover {
            top: -1px;
            left: -1px;
            box-shadow: 2px 2px 0 0 var(--colors-accent);
          }
          a:active {
            top: 1px;
            left: 1px;
            box-shadow: 0px 0px 0 0 var(--colors-accent);
          }
        `}</style>
      </a>
    </Link>
  )
}

interface TagsProps {
  tags: string[]
}

const Tags = ({ tags }: TagsProps) => {
  return (
    <>
      {tags.map((tag) => (
        <div key={tag} className="tag">
          <Tag>{tag}</Tag>
        </div>
      ))}
      <style jsx>{`
        .tag {
          margin-right: var(--spaces-xs);
        }
      `}</style>
    </>
  )
}

export default Tags
