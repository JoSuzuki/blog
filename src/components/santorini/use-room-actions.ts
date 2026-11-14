import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribeToSantorini } from '~/lib/realtime/santorini-socket'
import type { RoomActionError } from '~/lib/santorini/room'
import { useReload } from '~/lib/use-reload'

/**
 * Runs the Santorini loaders again. The pages show loader data only, so this
 * is what follows every action and every change someone else made.
 */
export const useReloadSantorini = () => useReload('/games/santorini')

/**
 * Keeps a Santorini page live: its loader runs again whenever the channel
 * (`lobby` or a room code) reports a change. Without a socket the page still
 * works, it just has to be reloaded to see the other player's moves.
 */
export const useLiveSantorini = (channel: string) => {
  const reload = useReloadSantorini()
  useEffect(
    () => subscribeToSantorini(channel, () => void reload()),
    [channel, reload],
  )
  return reload
}

type ActionResult = { ok: true } | RoomActionError

/**
 * Runs actions one at a time (a click while one is in flight is dropped)
 * and keeps the last refusal's message for the page to show. `run` resolves
 * to the action's result, or to null when it was dropped or failed to reach
 * the server.
 *
 * By default the loaders run again afterwards, which is what a server
 * function about a room's life needs. A game move over the socket passes
 * `reload: false`: its result is pushed to the page as `santorini:game`.
 */
export const useRoomAction = ({ reload: reloadAfter = true } = {}) => {
  const reload = useReloadSantorini()
  const running = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async <T extends ActionResult>(action: () => Promise<T>) => {
      if (running.current) return null
      running.current = true
      setPending(true)
      setError(null)
      try {
        const result = await action()
        if (!result.ok) setError(result.message)
        if (reloadAfter) await reload()
        return result
      } catch {
        setError('Não foi possível falar com o servidor. Tente de novo.')
        return null
      } finally {
        running.current = false
        setPending(false)
      }
    },
    [reload, reloadAfter],
  )

  return { run, pending, error }
}
