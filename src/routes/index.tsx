import { createFileRoute } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import QultureRocksLink from '~/components/home/qulture-rocks-link'
import { MdxH2, MdxHr, MdxP } from '~/components/mdx/mdx-components'
import Navbar from '~/components/navbar/navbar'
import Posts from '~/components/posts/posts'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Home | JoSuzuki' }] }),
  component: Home,
})

function Home() {
  return (
    <>
      <Navbar animatedName />
      <Article>
        <MdxP>
          Hey, I'm Jonathan Suzuki a software engineer at <QultureRocksLink />!
          I enjoy playing smash bros and making cool things with code.
        </MdxP>
        <MdxHr />
        <MdxH2 slug="posts-recentes">Posts recentes</MdxH2>
        <Posts limit={5} />
        <Footer />
      </Article>
    </>
  )
}
