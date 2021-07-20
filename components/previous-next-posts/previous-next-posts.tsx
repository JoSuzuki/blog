import CommonLink from '../common-link/common-link'
import usePagesContext from '../use-pages-context/use-pages-context'

const PreviousNextPosts = () => {
  const { currentPage, posts } = usePagesContext()

  const currentPostIndex = posts.findIndex(
    (post) => post.route === currentPage.route,
  )

  const previousPost = posts[currentPostIndex + 1]
  const nextPost = posts[currentPostIndex - 1]

  return (
    <div className="container">
      <div className="pause">• • •</div>
      <div className="links-container">
        <div className="link-container previous">
          {previousPost && (
            <>
              <div>← Anterior</div>
              <CommonLink href={previousPost.route}>
                {previousPost.frontMatter?.title}
              </CommonLink>
            </>
          )}
        </div>
        <div className="link-container next">
          {nextPost && (
            <>
              <div>Próximo →</div>
              <CommonLink href={nextPost.route}>
                {nextPost.frontMatter?.title}
              </CommonLink>
            </>
          )}
        </div>
      </div>
      <style jsx>{`
        .container {
          margin-top: var(--spaces-xl);
        }
        .pause {
          display: flex;
          justify-content: center;
        }
        .links-container {
          display: flex;
          justify-content: space-between;
          margin-top: var(--spaces-md);
        }
        .link-container {
          max-width: 40%;
        }
        .next {
          text-align: right;
        }
        .previous {
          text-align: left;
        }
      `}</style>
    </div>
  )
}

export default PreviousNextPosts
