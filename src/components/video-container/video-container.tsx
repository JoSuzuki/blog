import type { ReactNode } from 'react'

const VideoContainer = ({ children }: { children: ReactNode }) => (
  <div className="flex w-full items-center justify-center">{children}</div>
)

export default VideoContainer
