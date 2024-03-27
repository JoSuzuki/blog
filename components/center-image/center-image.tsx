import Image, { ImageProps } from 'next/image'

const CenterImage = (props: ImageProps) => {
  return (
    <div>
      <Image {...props} />
      <style jsx>{`
        div {
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  )
}

export default CenterImage
