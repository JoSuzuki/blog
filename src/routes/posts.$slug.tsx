import { createFileRoute, notFound } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Comments from '~/components/comments/comments'
import Footer from '~/components/footer/footer'
import PostBody from '~/components/mdx/post-body'
import Navbar from '~/components/navbar/navbar'
import PostMeta from '~/components/post-meta/post-meta'
import PreviousNextPosts from '~/components/previous-next-posts/previous-next-posts'
import { getPost, loadPostBody } from '~/content/posts'
import { getComments } from '~/lib/comments/get-comments'

/** The post is not held back for longer than this by its comments. */
const COMMENTS_TIMEOUT_MS = 2000

/**
 * The post's comments, or null when they cannot be had in time. A post must
 * render whatever the database is doing, so a failure or a slow answer is
 * data ("no comments to show right now"), not an error.
 */
const loadComments = async (route: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), COMMENTS_TIMEOUT_MS)
  })
  const comments = getComments({ data: { route } }).then(
    (result) => (result.ok ? result.comments : null),
    () => null,
  )
  try {
    return await Promise.race([comments, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    const [comments] = await Promise.all([
      loadComments(post.route),
      // Loads the post's chunk so the body renders synchronously, in the
      // server's HTML and on client navigations. The body itself is not
      // loader data: only what is returned here is serialised to the client.
      loadPostBody(post.slug),
    ])
    return { post, comments }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const { title, description } = loaderData.post
    return {
      meta: [
        { title: `${title} | JoSuzuki` },
        { name: 'description', content: description },
        { property: 'og:description', content: description },
        { name: 'twitter:description', content: description },
        { name: 'twitter:title', content: title },
      ],
    }
  },
  component: Post,
})

// The legacy components/post/post.tsx layout.
function Post() {
  const { post, comments } = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <PostBody slug={post.slug} afterTitle={<PostMeta post={post} />} />
        <Comments key={post.route} route={post.route} comments={comments} />
        <PreviousNextPosts slug={post.slug} />
        <Footer />
      </Article>
    </>
  )
}
