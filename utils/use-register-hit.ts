import { useEffect, useState } from 'react'

const useRegisterHit = (route: string): number | null => {
  const [hits, setHits] = useState(null)
  useEffect(() => {
    // Don't count hits on localhost
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    // Invoke the function by making a request.
    // Update the URL to match the format of your platform.
    fetch(`/api/register-hit?route=${route}`)
      .then((res) => res.json())
      .then((json) => {
        if (typeof json.hits === 'number') {
          setHits(json.hits)
        }
      })
  }, [route])

  return hits
}

export default useRegisterHit
