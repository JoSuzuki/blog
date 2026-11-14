import { useEffect, useState } from 'react'

const startDelay = 2000 // in miliseconds
const typeDelay = 200 // in miliseconds

/** The home page's site name: "Jonathan " is typed away to "Jo", then "Suzuki" is selected. */
const JoSuzukiAnimated = () => {
  const [text, setText] = useState('Jonathan ')

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    for (let index = 0; index < 7; index++) {
      timeouts.push(
        setTimeout(
          () => setText((prevText) => prevText.slice(0, -1)),
          startDelay + typeDelay * (index + 1),
        ),
      )
    }
    return () => timeouts.forEach(clearTimeout)
  }, [])

  return (
    <div className="max-w-[55vw] flex-nowrap overflow-hidden text-ellipsis whitespace-nowrap">
      <span className="animate-blink-caret border-r-2 border-solid border-transparent text-lg wght-bold">{`${text}`}</span>
      <span className="relative animate-selected text-lg text-text wght-bold">
        Suzuki
      </span>
    </div>
  )
}

export default JoSuzukiAnimated
