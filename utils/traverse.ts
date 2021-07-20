import { Page } from '../nextra-theme/theme'

// BFS traverse the page map tree
export default function traverse(
  pageMap: Page[],
  matcher: (page: Page) => void,
): void {
  for (let i = 0; i < pageMap.length; i++) {
    matcher(pageMap[i])
  }
  for (let i = 0; i < pageMap.length; i++) {
    if (pageMap[i].children) {
      traverse(pageMap[i].children as unknown as Page[], matcher)
    }
  }
}
