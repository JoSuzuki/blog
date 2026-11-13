import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import {
  getLoadedPostBody,
  loadPostBody,
  type PostBody as PostBodyComponent,
} from '~/content/posts'
import { AfterTitleContext } from './after-title'
import { mdxComponents } from './mdx-components'

// Used only when the body was not already loaded by a route loader, which is
// the case while hydrating (loader data is transported, loaders do not rerun).
// React keeps the server-rendered HTML in place until the chunk arrives.
const lazyBodies = new Map<string, PostBodyComponent>()
const lazyBody = (slug: string) => {
  let body = lazyBodies.get(slug)
  if (!body) {
    body = lazy(async () => ({ default: await loadPostBody(slug) }))
    lazyBodies.set(slug, body)
  }
  return body
}

/** Renders a post's compiled MDX with the shared components map. */
export default function PostBody({
  slug,
  afterTitle = null,
}: {
  slug: string
  afterTitle?: ReactNode
}) {
  const Loaded: PostBodyComponent | undefined = getLoadedPostBody(slug)
  const Body = Loaded ?? lazyBody(slug)
  return (
    <AfterTitleContext value={afterTitle}>
      <Suspense fallback={null}>
        <Body components={mdxComponents} />
      </Suspense>
    </AfterTitleContext>
  )
}
