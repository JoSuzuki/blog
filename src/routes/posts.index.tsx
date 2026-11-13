import { createFileRoute } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import Posts from '~/components/posts/posts'

export const Route = createFileRoute('/posts/')({
  head: () => ({ meta: [{ title: 'Posts | JoSuzuki' }] }),
  component: PostsIndex,
})

function PostsIndex() {
  return (
    <>
      <Navbar />
      <Article>
        <h1>Posts</h1>
        <Posts />
        <Footer />
      </Article>
    </>
  )
}
