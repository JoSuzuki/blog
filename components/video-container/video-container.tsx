import React from 'react'

interface VideoContainerProps {
  children: React.ReactNode
}

const VideoContainer = ({ children }: VideoContainerProps) => {
  return (
    <div className="video-container">
      {children}
      <style jsx>{`
        .video-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
      `}</style>
    </div>
  )
}

export default VideoContainer
