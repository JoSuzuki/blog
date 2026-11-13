import CommonLink from '~/components/common-link/common-link'
import { usePostFilter } from '~/components/posts/use-post-filter'
import { getPosts } from '~/content/posts'

/** Links to the older and newer post around the current one. */
const PreviousNextPosts = ({ slug }: { slug: string }) => {
  const posts = getPosts(usePostFilter())

  // Not in the list: i = -1, so the legacy behaviour shows posts[0] as previous.
  const i = posts.findIndex((p) => p.slug === slug)
  const previousPost = posts[i + 1]
  const nextPost = posts[i - 1]

  return (
    <div className="mt-xl">
      <div className="flex justify-center">• • •</div>
      <div className="mt-md flex justify-between">
        <div className="max-w-[40%] text-left">
          {previousPost && (
            <>
              <div>← Anterior</div>
              <CommonLink href={previousPost.route}>
                {previousPost.title}
              </CommonLink>
            </>
          )}
        </div>
        <div className="max-w-[40%] text-right">
          {nextPost && (
            <>
              <div>Próximo →</div>
              <CommonLink href={nextPost.route}>{nextPost.title}</CommonLink>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PreviousNextPosts
