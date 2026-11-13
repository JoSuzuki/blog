import { createFileRoute, notFound } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import PostBody from '~/components/mdx/post-body'
import Navbar from '~/components/navbar/navbar'
import PostMeta from '~/components/post-meta/post-meta'
import PreviousNextPosts from '~/components/previous-next-posts/previous-next-posts'
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

// The legacy components/post/post.tsx layout.
function Post() {
  const { slug } = Route.useParams()
  // The loader has already thrown notFound() for unknown slugs.
  const post = getPost(slug)!
  return (
    <>
      <Navbar />
      <Article>
        <PostBody slug={slug} afterTitle={<PostMeta post={post} />} />
        {/*
          Step 6 mounts the comments block here, between the body and the
          previous/next links (legacy <Comments /> from
          components/comments/comments.tsx). The hit counter goes inside
          PostMeta (see the comment there).
        */}
        <PreviousNextPosts slug={slug} />
        <Footer />
      </Article>
    </>
  )
}
