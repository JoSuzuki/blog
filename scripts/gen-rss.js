import fs from 'fs/promises'
import path from 'path'
import RSS from 'rss'
import matter from 'gray-matter'
import ReactDOMServer from 'react-dom'
import React from 'react'
import { serialize } from 'next-mdx-remote/serialize'
import { MDXRemote } from 'next-mdx-remote'

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
      const source = await serialize(frontmatter.content)

      feed.item({
        title: frontmatter.data.title,
        url: '/posts/' + name.replace(/\.mdx?/, ''),
        date: frontmatter.data.date,
        description: frontmatter.data.description,
        content: ReactDOMServer.renderToStaticMarkup(
          React.createElement(MDXRemote, source),
        ),
        categories: frontmatter.data.tags,
        author: frontmatter.data.author,
      })
    }),
  )

  await fs.writeFile('./public/feed.xml', feed.xml({ indent: true }))
}

generate()
