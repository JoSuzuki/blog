import { Link } from '@tanstack/react-router'
import CommonLink from '~/components/common-link/common-link'
import Tags from '~/components/tags/tags'
import { formatPostDate, getPosts, getPostsByTag } from '~/content/posts'
import { usePostFilter } from './use-post-filter'

interface PostsProps {
  /** Only posts with this tag (the tag page). */
  tag?: string
  /** At most this many, newest first (the home page shows 5). */
  limit?: number
}

/** The list of posts used on home, the posts index and tag pages. */
const Posts = ({ tag, limit }: PostsProps) => {
  const filter = usePostFilter()
  const posts = tag ? getPostsByTag(tag, filter) : getPosts(filter)
  const limitedPosts = limit ? posts.slice(0, limit) : posts

  return (
    <ul>
      {limitedPosts.map((post) => (
        <li key={post.route} className="mb-md">
          <h3>
            <Link to="/posts/$slug" params={{ slug: post.slug }}>
              {post.title}
            </Link>
          </h3>
          {post.description && (
            <p>
              {post.description}
              <span className="ml-sm">
                <CommonLink href={post.route}>Leia Mais →</CommonLink>
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center text-sm text-accent">
            <div className="mr-xs">
              {/* The legacy markup carried the YAML date as an ISO instant. */}
              <time dateTime={`${post.date}T00:00:00.000Z`}>
                {formatPostDate(post.date)}
              </time>
            </div>
            -<div className="mx-xs">{post.author}</div>-
            <div className="mr-xs"></div>
            <Tags tags={post.tags} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default Posts
