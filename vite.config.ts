import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig } from 'vite'
import rehypeHeadingSlugs from './src/content/rehype-heading-slugs.ts'
import { mdxFrontmatterModule } from './src/content/vite-plugins.ts'

const port = Number(process.env.PORT) || 3000

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
  plugins: [
    mdxFrontmatterModule(),
    {
      // MDX 3 + the same GFM features the MDX 1 pipeline had (~~strikethrough~~).
      enforce: 'pre',
      ...mdx({
        include: /\.mdx$/,
        remarkPlugins: [
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: 'frontmatter' }],
          remarkGfm,
        ],
        rehypePlugins: [rehypeHeadingSlugs],
      }),
    },
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
