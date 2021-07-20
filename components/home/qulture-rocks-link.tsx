import React from 'react'

const QultureRocksLink = () => {
  return (
    <a href="https://www.qulture.rocks/">
      qulture.rocks
      <style jsx>{`
        a {
          color: var(--colors-text);
          font-weight: bold;
          font-family: Space Grotesk, sans-serif;
          text-decoration: none;
          position: relative;
          border: dashed 1px #cd90ff;
        }
        a::before {
          position: absolute;
          content: 'qulture.rocks';
          background-color: #cd90ff;
          color: var(--colors-black);
          clip-path: polygon(1% 15%,1% 15%, 0% 84%, 0 84%);
          transition: clip-path 275ms ease;
          top: -3px;
        }
        a:hover::before {
          clip-path: polygon(1% 15%,99% 15%,99% 84%,1% 84%);
        }
      `}</style>
    </a>
  )
}

export default QultureRocksLink
