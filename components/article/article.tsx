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
          padding-top: var(--spaces-md);
          padding-bottom: var(--spaces-xl);
        }
        @media screen and (min-width: 768px) {
          .container {
            max-width: 65ch;
            line-height: 1.75;
            font-size: 1rem;
          }
        }
      `}</style>
    </article>
  )
}

export default Article
