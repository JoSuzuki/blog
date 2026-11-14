import Tags from '~/components/tags/tags'
import useRegisterHit from './use-register-hit'
import { formatPostDate } from '~/content/posts'
import type { PostMeta as PostMetaData } from '~/content/posts'

/** Author, date and tags line above a post. */
const PostMeta = ({ post }: { post: PostMetaData }) => {
  const hits = useRegisterHit(post.route)
  return (
    <div className="mb-md flex flex-wrap items-center text-sm">
      <div className="mr-xs">{post.author}</div>-
      <div className="mx-xs">{formatPostDate(post.date)}</div>-
      <div className="mr-xs"></div>
      <Tags tags={post.tags} />
      {hits !== null && hits > 100 && (
        <div className="ml-auto text-accent">{hits} views</div>
      )}
    </div>
  )
}

export default PostMeta
