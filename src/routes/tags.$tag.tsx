import { createFileRoute } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import Posts from '~/components/posts/posts'
import { TagName } from '~/components/tags/tags'

// Any tag renders, as on the live site: an unknown tag is a 200 with the tag
// in the heading and an empty list. The router decodes the param, so
// `/tags/reflex%C3%B5es` gives `reflexões`.
export const Route = createFileRoute('/tags/$tag')({
  head: () => ({ meta: [{ title: 'Tagged Posts | JoSuzuki' }] }),
  component: TagPage,
})

function TagPage() {
  const { tag } = Route.useParams()
  return (
    <>
      <Navbar />
      <Article>
        <h1>
          Posts com a tag “<TagName tag={tag} />”
        </h1>
        <Posts tag={tag} />
        <Footer />
      </Article>
    </>
  )
}
