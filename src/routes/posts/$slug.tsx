import { createFileRoute, notFound } from '@tanstack/react-router'
import Article from '~/components/article/article'
import PostBody from '~/components/mdx/post-body'
import { getPost, loadPostBody } from '~/content/posts'

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    // Loads the post's chunk so the body renders synchronously, in the
    // server's HTML and on client navigations. Only metadata is returned: it
    // is what gets serialised to the client.
    await loadPostBody(post.slug)
    return { title: post.title, description: post.description }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | JoSuzuki` },
          { name: 'description', content: loaderData.description },
          { property: 'og:description', content: loaderData.description },
          { name: 'twitter:description', content: loaderData.description },
          { name: 'twitter:title', content: loaderData.title },
        ]
      : [],
  }),
  component: Post,
})

function Post() {
  const { slug } = Route.useParams()
  return (
    <Article>
      <PostBody slug={slug} />
    </Article>
  )
}
