import SocialMediaLinks from '~/components/social-media-links/social-media-links'

/**
 * Copyright line and social links under a top border. The year is read on
 * each render rather than once per module (as the legacy file did), so a
 * long-running server does not keep showing last year.
 */
const Footer = () => {
  return (
    <div className="mt-xl flex items-center justify-between border-t border-accent pt-lg text-xs">
      <span>
        <time>{new Date().getFullYear()}</time> © Jonathan Suzuki.
      </span>
      <SocialMediaLinks />
    </div>
  )
}

export default Footer
