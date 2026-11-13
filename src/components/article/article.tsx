import type { ReactNode } from 'react'

const Article = ({ children }: { children: ReactNode }) => {
  return (
    <article className="mx-auto w-full pb-xl tablet:max-w-container tablet:text-md tablet:leading-[1.75]">
      {children}
    </article>
  )
}

export default Article
