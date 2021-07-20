import { Page } from '../nextra-theme/theme'

const sortDate = (a: Page, b: Page) => {
  if (!a.frontMatter || !a.frontMatter.date) return -1
  if (!b.frontMatter || !b.frontMatter.date) return -1
  return new Date(a.frontMatter.date) > new Date(b.frontMatter.date) ? -1 : 1
}

export default sortDate
