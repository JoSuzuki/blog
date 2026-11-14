import { Suspense, lazy, useState } from 'react'
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

// The component type is picked once per mount. Picking it on every render
// would swap the lazy wrapper for the resolved component after the chunk
// arrives, and React would unmount and remount the whole body (reloading
// iframes, losing focus and state). `key={slug}` gives a new mount, and so a
// new pick, when the post changes.
function MountedBody({ slug }: { slug: string }) {
  const [Body] = useState<PostBodyComponent>(
    () => getLoadedPostBody(slug) ?? lazyBody(slug),
  )
  return <Body components={mdxComponents} />
}

/** Renders a post's compiled MDX with the shared components map. */
export default function PostBody({
  slug,
  afterTitle = null,
}: {
  slug: string
  afterTitle?: ReactNode
}) {
  return (
    <AfterTitleContext value={afterTitle}>
      <Suspense fallback={null}>
        <MountedBody key={slug} slug={slug} />
      </Suspense>
    </AfterTitleContext>
  )
}
