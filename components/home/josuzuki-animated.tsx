import React, { useEffect, useState } from 'react'

const startDelay = 2000 // in miliseconds
const typeDelay = 200 // in miliseconds

const JoSuzukiAnimated = () => {
  const [text, setText] = useState('Jonathan ')

  useEffect(() => {
    for (let index = 0; index < 7; index++) {
      setTimeout(
        () => setText((prevText) => prevText.slice(0, -1)),
        startDelay + typeDelay * (index + 1),
      )
    }
  }, [])

  return (
    <div className="container">
      <span className="jo">{`${text}`}</span>
      <span className="suzuki">Suzuki</span>
      <style jsx>{`
        .container {
          flex-wrap: nowrap;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 55vw;
        }
        .jo {
          font-size: var(--font-sizes-lg);
          font-variation-settings: var(--font-weights-bold);
          animation: blink-caret 4.5s step-end forwards;
          border-right: solid 2px transparent;
        }
        @keyframes blink-caret {
          from {
            border-color: transparent;
          }
          15% {
            border-color: var(--colors-text);
          }
          30% {
            border-color: transparent;
          }
          44% {
            border-color: var(--colors-text);
          }
          to {
            border-right: none 0px;
          }
        }
        .suzuki {
          position: relative;
          font-size: var(--font-sizes-lg);
          color: var(--colors-text);
          font-variation-settings: var(--font-weights-bold);
          animation: selected 1.5s step-start forwards;
          animation-delay: 4.5s;
        }
        @keyframes selected {
          from {
          }
          50% {
            background-color: var(--colors-selection);
            color: var(--colors-white);
          }
          to {
            color: var(--colors-accent);
            background-color: initial;
          }
        }
      `}</style>
    </div>
  )
}

export default JoSuzukiAnimated
