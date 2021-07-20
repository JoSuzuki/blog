import React from 'react'

const JoSuzuki = () => {
  return (
    <div>
      <span className="jo">Jo</span>
      <span className="suzuki">Suzuki</span>
      <style jsx>{`
        .jo {
          font-size: var(--font-sizes-lg);
          font-variation-settings: var(--font-weights-bold);
        }
        .suzuki {
          font-size: var(--font-sizes-lg);
          font-variation-settings: var(--font-weights-bold);
          color: var(--colors-accent);
        }
      `}</style>
    </div>
  )
}

export default JoSuzuki
