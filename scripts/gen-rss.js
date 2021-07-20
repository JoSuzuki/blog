const { promises: fs } = require('fs')
const path = require('path')
const RSS = require('rss')
const matter = require('gray-matter')
const { serialize } = require('next-mdx-remote/serialize')
const { MDXRemote } = require('next-mdx-remote')

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
      const source = await serialize(content)

      feed.item({
        title: frontmatter.data.title,
        url: '/posts/' + name.replace(/\.mdx?/, ''),
        date: frontmatter.data.date,
        description: frontmatter.data.description,
        content: ReactDOMServer.renderToStaticMarkup(<MDXRemote {...source} />),
        categories: frontmatter.data.tags,
        author: frontmatter.data.author,
      })
    }),
  )

  await fs.writeFile('./public/feed.xml', feed.xml({ indent: true }))
}

generate()
