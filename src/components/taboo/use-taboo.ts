import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  subscribeToConnection,
  subscribeToTaboo,
  subscribeToTabooPresence,
  subscribeToTabooState,
} from '~/lib/realtime/taboo-socket'
import type { TabooPresencePayload } from '~/lib/realtime/events'
import type { RoomActionError, RoomView } from '~/lib/taboo/room'
import { useReload } from '~/lib/use-reload'

/** Runs the Tabu loaders again. */
export const useReloadTaboo = () => useReload('/games/tabu')

/**
 * Keeps a Tabu page live: its loader runs again whenever the channel (`lobby`
 * or a room code) reports a change, and after every reconnection.
 */
export const useLiveTaboo = (channel: string) => {
  const reload = useReloadTaboo()
  useEffect(
    () => subscribeToTaboo(channel, () => void reload()),
    [channel, reload],
  )
  return reload
}

type ActionResult = { ok: true } | RoomActionError

/**
 * Runs actions one at a time (a click while one is in flight is dropped) and
 * keeps the last refusal's message. With `reload` (the default) the loaders
 * run again afterwards, for the room's life; game events pass `reload: false`
 * because their result is pushed.
 */
export const useRoomAction = ({ reload: reloadAfter = true } = {}) => {
  const reload = useReloadTaboo()
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
        if (reloadAfter || (!result.ok && result.error === 'conflict')) {
          await reload()
        }
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

  return { run, pending, error, setError }
}

/**
 * The room as it is now: the newer of the loader's view and the last one the
 * server pushed (by `version`), who has it open, and how far this browser's
 * clock is from the server's.
 */
export const useTabooRoom = (loaderRoom: RoomView) => {
  const { roomCode } = loaderRoom
  const [pushed, setPushed] = useState<RoomView | null>(null)
  const [presence, setPresence] = useState<TabooPresencePayload | null>(null)

  useEffect(
    () =>
      subscribeToTabooState((room) => {
        if (room.roomCode !== roomCode) return
        setPushed((current) =>
          current && current.version > room.version ? current : room,
        )
      }),
    [roomCode],
  )
  useEffect(
    () =>
      subscribeToTabooPresence((payload) => {
        if (payload.roomCode !== roomCode) return
        setPresence((current) =>
          current && current.at > payload.at ? current : payload,
        )
      }),
    [roomCode],
  )

  // On a tie the loader wins: it is the fresher read of the same version.
  const room =
    pushed && pushed.version > loaderRoom.version ? pushed : loaderRoom

  // serverNow was the server's clock when the view was made; this is when the
  // browser got it, near enough.
  const clockOffset = useMemo(
    () => room.serverNow - Date.now(),
    // Only a new view moves the clock.
    [room],
  )

  const online =
    presence && presence.at > room.serverNow ? presence.online : room.online

  return { room, online, clockOffset }
}

/**
 * Whether the socket is connected. Starts as true so the first render (and
 * server rendering) does not flash a warning; a connection that fails, or
 * drops later, shows after a short delay.
 */
export const useConnected = () => {
  const [connected, setConnected] = useState(true)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = subscribeToConnection((isConnected) => {
      clearTimeout(timer)
      if (isConnected) setConnected(true)
      else timer = setTimeout(() => setConnected(false), 1500)
    })
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [])
  return connected
}

/** The current time on the server's clock, refreshed `fps` times a second while `active`. */
export const useServerNow = (
  clockOffset: number,
  active: boolean,
  fps = 10,
) => {
  const [now, setNow] = useState(() => Date.now() + clockOffset)
  useEffect(() => {
    setNow(Date.now() + clockOffset)
    if (!active) return
    const id = setInterval(() => setNow(Date.now() + clockOffset), 1000 / fps)
    return () => clearInterval(id)
  }, [clockOffset, active, fps])
  return now
}
