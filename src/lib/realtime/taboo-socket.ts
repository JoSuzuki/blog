import type { RoomView } from '~/lib/taboo/room'
import {
  acquireSocket,
  getSocket,
  onSocketCreated,
  reconnectSocket,
  releaseSocket,
  whenSocketReady,
} from './connection'
import type { ClientSocket } from './connection'
import type { TabooAck, TabooCardInput, TabooPresencePayload } from './events'

// Tabu over the page's shared socket, the same way as Santorini:
//
// - Channels (`lobby`, or a room's code) say that what they show changed, for
//   the room's life (the list, the lobby). Being in a room's channel is also
//   how the others see that this reader has the room open.
// - A game is played on it: the moves go out as events answered by an ack,
//   and each new state comes back to every player as `taboo:state`, made for
//   them.

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

const subscriptions = new Set<{ channel: string; onChange: () => void }>()

const channelsInUse = () => new Set([...subscriptions].map((s) => s.channel))

const notify = (channel: string) => {
  for (const sub of subscriptions) if (sub.channel === channel) sub.onChange()
}

const joinAndSync = (socket: ClientSocket, channel: string) => {
  socket.emit('taboo:join', channel, (ack) => {
    // Joined, first time or after a reconnection: changes made while there
    // was no connection were missed, so load again.
    if (ack.ok) notify(channel)
  })
}

/**
 * Calls `onChange` whenever the channel's data may have changed: on every
 * `taboo:changed` event and each time the socket (re)joins the channel.
 * Returns the function that stops.
 */
export const subscribeToTaboo = (
  channel: string,
  onChange: () => void,
): (() => void) => {
  const subscription = { channel, onChange }
  subscriptions.add(subscription)
  const socket = acquireSocket()
  if (socket?.connected) joinAndSync(socket, channel)

  return () => {
    subscriptions.delete(subscription)
    // The socket as it is now: it may have been created since subscribing.
    const current = getSocket()
    if (current?.connected && !channelsInUse().has(channel)) {
      current.emit('taboo:leave', channel)
    }
    releaseSocket()
  }
}

// ---------------------------------------------------------------------------
// Pushed state, presence, connection
// ---------------------------------------------------------------------------

const stateListeners = new Set<(room: RoomView) => void>()
const presenceListeners = new Set<(payload: TabooPresencePayload) => void>()
const connectionListeners = new Set<(connected: boolean) => void>()

onSocketCreated((socket) => {
  socket.on('connect', () => {
    for (const channel of channelsInUse()) joinAndSync(socket, channel)
    for (const listener of connectionListeners) listener(true)
  })
  socket.on('disconnect', () => {
    for (const listener of connectionListeners) listener(false)
  })
  socket.on('taboo:changed', ({ channel }) => notify(channel))
  socket.on('taboo:state', (room) => {
    for (const listener of stateListeners) listener(room)
  })
  socket.on('taboo:presence', (payload) => {
    for (const listener of presenceListeners) listener(payload)
  })
})

/** Calls `onState` with every pushed state of the rooms the reader plays in. */
export const subscribeToTabooState = (
  onState: (room: RoomView) => void,
): (() => void) => {
  stateListeners.add(onState)
  acquireSocket()
  return () => {
    stateListeners.delete(onState)
    releaseSocket()
  }
}

/** Calls `onPresence` whenever who has a room open changes. */
export const subscribeToTabooPresence = (
  onPresence: (payload: TabooPresencePayload) => void,
): (() => void) => {
  presenceListeners.add(onPresence)
  acquireSocket()
  return () => {
    presenceListeners.delete(onPresence)
    releaseSocket()
  }
}

/** Calls `onChange` with the socket's state now and on every change. */
export const subscribeToConnection = (
  onChange: (connected: boolean) => void,
): (() => void) => {
  connectionListeners.add(onChange)
  const socket = acquireSocket()
  // Null while socket.io-client downloads: not connected yet, and the
  // 'connect' listener above reports it once it is.
  onChange(socket?.connected ?? false)
  return () => {
    connectionListeners.delete(onChange)
    releaseSocket()
  }
}

// ---------------------------------------------------------------------------
// Game events
// ---------------------------------------------------------------------------

/** An event is given up on after this long without an answer. */
const ANSWER_TIMEOUT_MS = 6000

const NO_ANSWER: TabooAck = {
  ok: false,
  error: 'unavailable',
  message: 'Sem resposta do servidor. Verifique a conexão e tente de novo.',
}

/**
 * Sends a game event and resolves to the server's answer, or to a refusal
 * when none comes in time. Never rejects. A "log in" answer may mean the
 * reader logged in since the socket connected: it reconnects and tries once
 * more.
 */
const send = (
  emit: (
    socket: ReturnType<ClientSocket['timeout']>,
    done: (error: Error | null, answer: TabooAck) => void,
  ) => void,
): Promise<TabooAck> =>
  new Promise((resolve) => {
    acquireSocket()
    void whenSocketReady().then((socket) => {
      if (!socket) {
        releaseSocket()
        resolve(NO_ANSWER)
        return
      }
      const attempt = (retryAsLoggedIn: boolean) => {
        emit(socket.timeout(ANSWER_TIMEOUT_MS), (error, answer) => {
          if (
            !error &&
            !answer.ok &&
            answer.error === 'login' &&
            retryAsLoggedIn
          ) {
            reconnectSocket()
            attempt(false)
            return
          }
          releaseSocket()
          resolve(error ? NO_ANSWER : answer)
        })
      }
      attempt(true)
    })
  })

export const startTurn = (roomCode: string) =>
  send((socket, done) => socket.emit('taboo:start-turn', roomCode, done))

export const playCard = (roomCode: string, input: TabooCardInput) =>
  send((socket, done) => socket.emit('taboo:card', roomCode, input, done))

export const timeUp = (roomCode: string, turnNumber: number) =>
  send((socket, done) =>
    socket.emit('taboo:time-up', roomCode, turnNumber, done),
  )

export const passSpeaker = (roomCode: string, turnNumber: number) =>
  send((socket, done) => socket.emit('taboo:pass', roomCode, turnNumber, done))
