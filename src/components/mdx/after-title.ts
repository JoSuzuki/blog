import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

// Whatever the page wants rendered right after the post's `# title` heading
// (the post meta line). The title is part of the MDX body, so the body is what
// has to place it.
export const AfterTitleContext = createContext<ReactNode>(null)
export const useAfterTitle = () => useContext(AfterTitleContext)
