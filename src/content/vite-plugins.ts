import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import type { Plugin } from 'vite'
import { z } from 'zod'
import { postFrontmatterSchema } from './post-schema.ts'

const PREFIX = '\0blog-meta:'
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/

/**
 * `post.mdx?meta` resolves to the post's frontmatter only (as JSON), so the
 * collection can list every post without importing any post body. A post whose
 * frontmatter fails the schema fails the build, naming the file.
 */
export function mdxFrontmatterModule(): Plugin {
  return {
    name: 'blog:mdx-frontmatter-module',
    enforce: 'pre',
    // A virtual id, so that the MDX plugin (which ignores query strings when
    // deciding what to compile) never sees these imports.
    async resolveId(source, importer, options) {
      if (!source.endsWith('.mdx?meta')) return null
      const resolved = await this.resolve(
        source.slice(0, -'?meta'.length),
        importer,
        { ...options, skipSelf: true },
      )
      return resolved ? PREFIX + resolved.id : null
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null
      const file = id.slice(PREFIX.length)
      this.addWatchFile(file)
      const match = FRONTMATTER.exec(readFileSync(file, 'utf8'))
      if (!match) this.error(`${file}: missing YAML frontmatter`)
      let data: unknown
      try {
        data = parse(match[1])
      } catch (error) {
        this.error(
          `${file}: invalid YAML frontmatter: ${(error as Error).message}`,
        )
      }
      const result = postFrontmatterSchema.safeParse(data)
      if (!result.success) {
        this.error(
          `${file}: invalid frontmatter\n${z.prettifyError(result.error)}`,
        )
      }
      return `export default ${JSON.stringify(result.data)}`
    },
  }
}
