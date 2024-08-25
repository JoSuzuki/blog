import { ReactNode } from 'react'

const Article = ({ children }: { children: ReactNode }) => {
  return (
    <article className="container">
      {children}
      <style jsx>{`
        .container {
          width: 100%;
          margin-left: auto;
          margin-right: auto;
          padding-bottom: var(--spaces-xl);
        }
        @media screen and (min-width: 768px) {
          .container {
            max-width: var(--container-max-width);
            line-height: 1.75;
            font-size: var(--font-sizes-md);
          }
        }
      `}</style>
    </article>
  )
}

export default Article
