import React, { useLayoutEffect, useState } from 'react'
import ReactDOMServer from 'react-dom/server'
import Head from 'next/head'
import { useRouter } from 'next/router'

import { PagesContext } from '../components/use-pages-context/use-pages-context'
import Article from '../components/article/article'

import MDXTheme from '../components/mdx-theme/mdx-theme'
import Navbar from '../components/navbar/navbar'
import Footer from '../components/footer/footer'

import traverse from '../utils/traverse'
import getTitle from '../utils/get-title'
import sortDate from '../utils/sort-date'
import { useRedactedContext } from '../components/redacted/redacted'
import Post from '../components/post/post'

export interface CurrentPage {
  filename: string
  route: string
  meta?: Record<string, any>
}

export interface Page {
  name: string
  route: string
  frontMatter?: Record<string, any>
  children?: React.ReactElement
}

export interface NavPage {
  name: string
  route: string
  active?: boolean
  frontMatter?: Record<string, any>
}

interface Opts {
  filename: string
  route: string
  pageMap: Page[]
  /* Frontmatter attributes */
  meta: Record<string, any>
}

type MDXFileChildren = any // these will be the children of mdx file

interface LayoutProps {
  children: MDXFileChildren
  title: React.ReactElement
  meta: Record<string, any>
}

const Layout = ({ meta, title, children }: LayoutProps) => {
  const [titleNode, contentNodes] = getTitle(children)
  const type = meta.type || 'post'

  const pageTitle = <title>{title} | JoSuzuki</title>

  const getLayoutForType = (
    type: 'post' | 'customPage' | 'customPost' | 'tag' | 'page',
  ) => {
    switch (type) {
      case 'post':
        return <Post meta={meta} pageTitle={pageTitle} contentNodes={contentNodes} titleNode={titleNode} />
      case 'customPage':
        return (
          <React.Fragment>
            <Head>{pageTitle}</Head>
            <MDXTheme>{contentNodes}</MDXTheme>
          </React.Fragment>
        )
      case 'customPost': // TODO: not being used yet, you can change as you want
        return (
          <React.Fragment>
            <Head>{pageTitle}</Head>
            <MDXTheme>{contentNodes}</MDXTheme>
          </React.Fragment>
        )
      case 'tag':
      case 'page':
      default:
        return (
          <React.Fragment>
            <Head>{pageTitle}</Head>
            <Navbar />
            <Article>
              {titleNode}
              <MDXTheme>{contentNodes}</MDXTheme>
              <Footer />
            </Article>
          </React.Fragment>
        )
    }
  }

  return getLayoutForType(type)
}

const withLayout = (opts: Opts) => {
  // gather info for tag/posts pages
  let posts: Page[] = []
  let secretPosts: Page[] = []
  let navPages: NavPage[] = []
  const type = opts.meta.type || 'post'
  const route = opts.route

  // This only renders once per page
  // let's get all posts
  traverse(opts.pageMap, (page: Page) => {
    if (
      page.frontMatter &&
      ['page', 'posts', 'customPage'].includes(page.frontMatter.type)
    ) {
      if (
        (route.includes(page.route) && page.route !== '/') ||
        (route === page.route && page.route === '/')
      ) {
        navPages.push({ ...page, active: true })
      } else {
        navPages.push(page)
      }
    }
    if (page.name === "404") return
    if (page.route.startsWith('/api/')) return
    if (page.children) return
    if (page.name.startsWith('_')) return
    if (
      type === 'posts' &&
      !page.route.startsWith(route === '/' ? route : route + '/')
    )
      return
    if (
      type !== 'page' &&
      (!page.frontMatter ||
        !page.frontMatter.type ||
        page.frontMatter.type === 'post')
    ) {
      if(page.frontMatter?.secret) {
        secretPosts.push(page)
      } else {
        posts.push(page)
      }
    }
  })
  posts = posts.sort(sortDate)
  navPages = navPages.sort(sortDate)

  const ComponentWithLayout = (props: MDXFileChildren) => {
    const [availablePosts, setAvailablePosts] = useState(posts);

    const { reveal } = useRedactedContext()

    useLayoutEffect(() => {
      if(reveal) {
        setAvailablePosts(posts.concat(secretPosts).sort(sortDate))
      } else {
        setAvailablePosts(posts)
      }
    }, [reveal, posts, secretPosts])

    const router = useRouter()
    const { query } = router

    const type = opts.meta.type || 'post'
    const tagName = type === 'tag' ? query.tag : null

    const [titleNode] = getTitle(props.children)
    const title =
      opts.meta.title ||
      (typeof tagName === 'undefined'
        ? null
        : titleNode
        ? ReactDOMServer.renderToStaticMarkup(
            (titleNode as React.ReactElement).props.children,
          )
        : null) ||
      ''

    return (
      <PagesContext.Provider
        value={{
          posts: availablePosts,
          navPages,
          currentPage: {
            filename: opts.filename,
            route: opts.route,
            meta: opts.meta,
          },
        }}
      >
        <Layout title={title} {...opts} {...props} />
      </PagesContext.Provider>
    )
  }

  return ComponentWithLayout
}

export default withLayout
