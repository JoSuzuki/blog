import Head from 'next/head'
import React from 'react'
import Article from '../article/article'
import Comments from '../comments/comments'
import Footer from '../footer/footer'
import MDXTheme from '../mdx-theme/mdx-theme'
import Navbar from '../navbar/navbar'
import PostMeta from '../post-meta/post-meta'
import PreviousNextPosts from '../previous-next-posts/previous-next-posts'

interface PostProps {
  pageTitle: React.ReactNode
  meta: Record<string, any>
  titleNode: React.ReactNode
  contentNodes: React.ReactNode
}

const Post = ({ meta, pageTitle, titleNode, contentNodes }: PostProps) => {
  return (
    <React.Fragment>
      <Head>
        {pageTitle}
        <meta name="description" content={meta.description} />
        <meta property="og:description" content={meta.description} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:title" content={meta.title} />
      </Head>
      <Navbar />
      <Article>
        {titleNode}
        <PostMeta />
        <MDXTheme>{contentNodes}</MDXTheme>
        <Comments />
        <PreviousNextPosts />
        <Footer />
      </Article>
    </React.Fragment>
  )
}

export default Post
