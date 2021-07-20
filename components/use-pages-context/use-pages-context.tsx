import React from 'react'
import { CurrentPage, NavPage, Page } from '../../nextra-theme/theme'

export const PagesContext = React.createContext<{
  posts: Page[]
  navPages: NavPage[]
  currentPage: CurrentPage
}>({
  posts: [],
  navPages: [],
  currentPage: { filename: '', route: '' },
})

const usePagesContext = () => React.useContext(PagesContext)

export default usePagesContext
