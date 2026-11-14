import Slugger from 'github-slugger'
import type { Element, Root, RootContent } from 'hast'

const HEADINGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6'])

// The legacy theme slugged `renderToStaticMarkup(children)` of each heading, so
// characters React escapes leave residue in the id (`"` becomes `&quot;` and
// then `quot`). Existing deep links contain that residue, so keep producing it.
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

const markup = (node: RootContent): string => {
  if (node.type === 'text') return escapeHtml(node.value)
  if (node.type === 'element') {
    const inner = node.children.map(markup).join('')
    return `<${node.tagName}>${inner}</${node.tagName}>`
  }
  return ''
}

const visit = (node: Root | Element, slugger: Slugger) => {
  for (const child of node.children) {
    if (child.type !== 'element') continue
    if (HEADINGS.has(child.tagName)) {
      child.properties.slug = slugger.slug(child.children.map(markup).join(''))
    } else {
      visit(child, slugger)
    }
  }
}

/** Gives every h2..h6 a `slug` prop, unique within the post, in document order. */
export default function rehypeHeadingSlugs() {
  return (tree: Root) => visit(tree, new Slugger())
}
