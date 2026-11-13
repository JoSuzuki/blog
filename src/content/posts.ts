import type { ComponentType } from 'react'
import type { MDXProps } from 'mdx/types'
import { z } from 'zod'
import { postFrontmatterSchema } from './post-schema.ts'

export type PostMeta = z.infer<typeof postFrontmatterSchema> & {
  /** File name without extension; the URL is `/posts/<slug>`. */
  slug: string
  route: `/posts/${string}`
}

export type PostBody = ComponentType<MDXProps>

// Frontmatter only (see `mdxFrontmatterModule`): importing it does not pull in
// any post body. Validation also runs in the Vite plugin, which is what fails
// the build; parsing again here types the data and names the file if it ever
// disagrees.
const metaModules = import.meta.glob<unknown>('/content/posts/*.mdx', {
  query: '?meta',
  import: 'default',
  eager: true,
})

// One dynamic import per post, so each compiled body is its own chunk.
const bodyLoaders = import.meta.glob<{ default: PostBody }>(
  '/content/posts/*.mdx',
)

const slugOf = (path: string) => path.replace(/^.*\//, '').replace(/\.mdx$/, '')

const byDateDescending = (a: PostMeta, b: PostMeta) =>
  a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? 1 : -1

const allPosts: PostMeta[] = Object.entries(metaModules)
  .map(([path, raw]) => {
    const parsed = postFrontmatterSchema.safeParse(raw)
    if (!parsed.success) {
      throw new Error(
        `${path}: invalid frontmatter\n${z.prettifyError(parsed.error)}`,
      )
    }
    const slug = slugOf(path)
    return { ...parsed.data, slug, route: `/posts/${slug}` } as PostMeta
  })
  .sort(byDateDescending)

const bySlug = new Map(allPosts.map((post) => [post.slug, post]))

export interface PostFilter {
  /** Include posts marked `secret: true`. Default false. */
  includeSecret?: boolean
}

const visible = (filter?: PostFilter) =>
  filter?.includeSecret ? allPosts : allPosts.filter((post) => !post.secret)

/** All posts, newest first. Secret posts are left out unless asked for. */
export const getPosts = (filter?: PostFilter): PostMeta[] => visible(filter)

/** One post's metadata, secret or not; undefined for an unknown slug. */
export const getPost = (slug: string): PostMeta | undefined => bySlug.get(slug)

/**
 * The older (`previous`) and newer (`next`) neighbours of a post within the
 * list the caller may see, as the legacy theme computed them.
 */
export const getNeighbours = (
  slug: string,
  filter?: PostFilter,
): { previous?: PostMeta; next?: PostMeta } => {
  const list = visible(filter)
  const index = list.findIndex((post) => post.slug === slug)
  if (index === -1) return {}
  return { previous: list[index + 1], next: list[index - 1] }
}

/** Every tag in use, alphabetically. */
export const getTags = (filter?: PostFilter): string[] =>
  [...new Set(visible(filter).flatMap((post) => post.tags))].sort()

export const getPostsByTag = (tag: string, filter?: PostFilter): PostMeta[] =>
  visible(filter).filter((post) => post.tags.includes(tag))

// Compiled components that have finished loading, so that rendering can be
// synchronous once a route's loader has awaited `loadPostBody`.
const loadedBodies = new Map<string, PostBody>()

/** Fetches (once) the chunk holding a post's compiled body. */
export const loadPostBody = async (slug: string): Promise<PostBody> => {
  const loaded = loadedBodies.get(slug)
  if (loaded) return loaded
  const load = bodyLoaders[`/content/posts/${slug}.mdx`]
  if (!load) throw new Error(`No post body for slug "${slug}"`)
  const body = (await load()).default
  loadedBodies.set(slug, body)
  return body
}

/** The body if `loadPostBody` has already resolved for this slug. */
export const getLoadedPostBody = (slug: string): PostBody | undefined =>
  loadedBodies.get(slug)

/** `date` as the legacy site displayed it: day/month/year, no zero padding. */
export const formatPostDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number)
  return `${day}/${month}/${year}`
}
