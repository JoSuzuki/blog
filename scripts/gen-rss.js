import fs from 'fs/promises'
import path from 'path'
import { Feed } from 'feed'
import matter from 'gray-matter'

const feed = new Feed({
  title: "JoSuzuki Blog",
  description: "Software engineer, smash bros player. Currently doing cool things with code.",
  id: "https://josuzuki.me",
  link: "https://josuzuki.me",
  language: "pt-BR", // optional, used only in RSS 2.0, possible values: http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
  // image: "http://example.com/image.png",
  favicon: "https://josuzuki.me/favicon.ico",
  copyright: "All rights reserved 2021 - Present, Jonathan Suzuki",
  feedLinks: {
    rss: "https://josuzuki.me/feed.xml",
    json: "https://josuzuki.me/json",
    atom: "https://josuzuki.me/atom"
  },
  author: {
    name: "Jonathan Suzuki",
    email: "jonathan@suzuki.pro.br",
    link: "https://josuzuki.me"
  }
});

async function generate() {
  const posts = await fs.readdir(
    path.join(__dirname, '..', '..', 'pages', 'posts'),
  )

  await Promise.all(
    posts.map(async (name) => {
      if (name.startsWith('index.')) return

      const content = await fs.readFile(
        path.join(__dirname, '..', '..', 'pages', 'posts', name),
      )

      const htmlBuffer = await fs.readFile(
        path.join(
          __dirname,
          '.',
          'pages',
          'posts',
          name.replace(/\.mdx?/, '.html'),
        ),
      )

      const frontmatter = matter(content)

      feed.addItem({
        title: frontmatter.data.title,
        id: '/posts/' + name.replace(/\.mdx?/, ''),
        link: '/posts/' + name.replace(/\.mdx?/, ''),
        date: frontmatter.data.date,
        description: frontmatter.data.description,
        content: htmlBuffer.toString('utf-8'),
        category: frontmatter.data.tags.map(tag => ({ name: tag })),
        author: [
          {
            name: frontmatter.data.author,
          },
        ],
        // image: post.image
      })
    }),
  )

  await fs.writeFile('./public/feed.xml', feed.rss2())
  await fs.writeFile('./public/atom.xml', feed.atom1())
  await fs.writeFile('./public/feed.json', feed.json1())
}

generate()
