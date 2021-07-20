import fs from 'fs/promises'
import path from 'path'
import RSS from 'rss'
import matter from 'gray-matter'
import renderToString from 'next-mdx-remote/render-to-string'
import { MDXProvider } from '@mdx-js/react'

async function generate() {
  const feed = new RSS({
    title: 'JoSuzuki Blog',
    site_url: 'https://josuzuki.me',
    feed_url: 'https://josuzuki.me/feed.xml',
  })

  const posts = await fs.readdir(path.join(__dirname, '..', 'pages', 'posts'))

  await Promise.all(
    posts.map(async (name) => {
      if (name.startsWith('index.')) return

      const content = await fs.readFile(
        path.join(__dirname, '..', 'pages', 'posts', name),
      )

      const frontmatter = matter(content)
      const { renderedOutput } = await renderToString(content, {
        provider: { component: MDXProvider },
        mdxOptions: {
          remarkPlugins: [],
          rehypePlugins: [],
        },
      })

      feed.item({
        title: frontmatter.data.title,
        url: '/posts/' + name.replace(/\.mdx?/, ''),
        date: frontmatter.data.date,
        description: frontmatter.data.description,
        content: ReactDOMServer.renderToStaticMarkup(
          <MDXProvider>
            <div dangerouslySetInnerHTML={{ __html: renderedOutput }}></div>
          </MDXProvider>,
        ),
        categories: frontmatter.data.tags,
        author: frontmatter.data.author,
      })
    }),
  )

  await fs.writeFile('./public/feed.xml', feed.xml({ indent: true }))
}

generate()
