import SocialMediaLinks from '../social-media-links/social-media-links'

const YEAR = new Date().getFullYear()

const Footer = () => {
  return (
    <div>
      <span>
        <time>{YEAR}</time> © Jonathan Suzuki.
      </span>
      <SocialMediaLinks />
      <style jsx>{`
        div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--spaces-xl);
          padding-top: var(--spaces-lg);
          border-top: 1px solid var(--colors-accent);
          font-size: var(--font-sizes-xs);
        }
        @media screen and (max-width: 480px) {
          article {
            padding-top: 2rem;
            padding-bottom: 4rem;
          }
        }
      `}</style>
    </div>
  )
}

export default Footer
