import formatDate from '../../utils/format-date'
import useRegisterHit from '../../utils/use-register-hit'
import Tags from '../tags/tags'
import usePagesContext from '../use-pages-context/use-pages-context'

const PostMeta = () => {
  const { currentPage } = usePagesContext()

  const hits = useRegisterHit(currentPage.route)

  if (!currentPage.meta) return null

  return (
    <div className="container">
      <div className="author">{currentPage.meta.author}</div>-
      <div className="date">{formatDate(currentPage.meta.date)}</div>-
      <div className="pre-tags"></div>
      <Tags tags={currentPage.meta.tags} />
      {hits !== null && hits > 100 && <div className="hits">{hits} views</div>}
      <style jsx>{`
        .container {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          font-size: var(--font-sizes-sm);
          margin-bottom: var(--spaces-md);
        }
        .author {
          margin-right: var(--spaces-xs);
        }
        .date {
          margin-right: var(--spaces-xs);
          margin-left: var(--spaces-xs);
        }
        .pre-tags {
          margin-right: var(--spaces-xs);
        }
        .hits {
          color: var(--colors-accent);
          margin-left: auto;
        }
      `}</style>
    </div>
  )
}

export default PostMeta
