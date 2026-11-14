import type { ComponentProps } from 'react'

type MdxImageProps = Omit<ComponentProps<'img'>, 'src' | 'width' | 'height'> & {
  src: string
  width: number
  height: number
  /** Accepted for compatibility with next/image; the browser decides. */
  priority?: boolean
}

// Replaces next/image in posts. The width and height attributes give the
// browser the aspect ratio before the file arrives (no layout shift); the image
// shows at its natural width and shrinks to fit narrow containers.
const MdxImage = ({ priority, alt, ...props }: MdxImageProps) => (
  <img
    {...props}
    alt={alt ?? ''}
    loading={priority ? 'eager' : 'lazy'}
    decoding="async"
    className="inline-block h-auto max-w-full"
  />
)

export default MdxImage
