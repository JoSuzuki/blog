import type { ComponentProps } from 'react'
import MdxImage from '~/components/mdx-image/mdx-image'

const CenterImage = (props: ComponentProps<typeof MdxImage>) => (
  <div className="flex justify-center">
    <MdxImage {...props} />
  </div>
)

export default CenterImage
