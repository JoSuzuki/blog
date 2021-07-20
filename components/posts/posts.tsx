import { useRouter } from 'next/dist/client/router'
import Link from 'next/link'
import formatDate from '../../utils/format-date'
import CommonLink from '../common-link/common-link'
import Tags from '../tags/tags'
import usePagesContext from '../use-pages-context/use-pages-context'

interface PostsProps {
  limit: number | null
}

const Posts = ({ limit }: PostsProps) => {
  const { posts } = usePagesContext()
  const { tag } = useRouter().query

  const filteredPosts = tag
    ? posts.filter((post) => post.frontMatter?.tags.includes(tag))
    : posts

  const limitedPosts = limit ? filteredPosts.slice(0, limit) : filteredPosts

  return (
    <ul>
      {limitedPosts.map((post) => {
        const postTitle = post.frontMatter?.title ?? post.name
        const postDate = post.frontMatter ? (
          <time dateTime={post.frontMatter.date}>
            {formatDate(post.frontMatter.date)}
          </time>
        ) : null
        const postDescription = post.frontMatter?.description && (
          <p>
            {post.frontMatter.description}
            <span className="read-more">
              <CommonLink href={post.route}>Leia Mais →</CommonLink>
            </span>
          </p>
        )

        const postAuthor = post.frontMatter?.author ?? 'Missing author'
        const postTags: string[] = post.frontMatter?.tags ?? []
        return (
          <li key={post.route}>
            <h3>
              <Link href={post.route}>
                <a>{postTitle}</a>
              </Link>
            </h3>
            {postDescription}
            <div className="more-info">
              <div className="date">{postDate}</div>-
              <div className="author">{postAuthor}</div>-
              <div className="pre-tags"></div>
              <Tags tags={postTags} />
            </div>
          </li>
        )
      })}
      <style jsx>{`
        li {
          margin-bottom: var(--spaces-md);
        }
        .date {
          margin-right: var(--spaces-xs);
        }
        .author {
          margin-left: var(--spaces-xs);
          margin-right: var(--spaces-xs);
        }
        .pre-tags {
          margin-right: var(--spaces-xs);
        }
        .more-info {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          color: var(--colors-accent);
          font-size: var(--font-sizes-sm);
        }
        .read-more {
          margin-left: var(--spaces-sm);
        }
      `}</style>
    </ul>
  )
}

export default Posts
