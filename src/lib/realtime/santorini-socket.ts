import {
  acquireSocket,
  onSocketCreated,
  reconnectSocket,
  releaseSocket,
} from './connection'
import type { ClientSocket } from './connection'
import type {
  SantoriniAck,
  SantoriniActionInput,
  SantoriniGameUpdate,
} from './events'

// Santorini over the page's shared socket. Two things travel on it:
//
// - Channels (`lobby`, or a room's code) only say that what they show
//   changed, for the pages about a room's life: the list, the lobby.
// - A game is played on it: the moves go out as events answered by an ack,
//   and each new state comes back to both players as `santorini:game`.

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

const subscriptions = new Set<{ channel: string; onChange: () => void }>()

const channelsInUse = () => new Set([...subscriptions].map((s) => s.channel))

const notify = (channel: string) => {
  for (const sub of subscriptions) if (sub.channel === channel) sub.onChange()
}

const joinAndSync = (socket: ClientSocket, channel: string) => {
  socket.emit('santorini:join', channel, (ack) => {
    // Joined, first time or after a reconnection: changes made while there
    // was no connection were missed, so load again.
    if (ack.ok) notify(channel)
  })
}

/**
 * Calls `onChange` whenever the channel's data may have changed: on every
 * `santorini:changed` event and each time the socket (re)joins the channel.
 * The event carries no data, so `onChange` should run the page's loader
 * again. Returns the function that stops.
 */
export const subscribeToSantorini = (
  channel: string,
  onChange: () => void,
): (() => void) => {
  const subscription = { channel, onChange }
  subscriptions.add(subscription)
  const socket = acquireSocket()
  if (socket.connected) joinAndSync(socket, channel)

  return () => {
    subscriptions.delete(subscription)
    if (socket.connected && !channelsInUse().has(channel)) {
      socket.emit('santorini:leave', channel)
    }
    releaseSocket()
  }
}

// ---------------------------------------------------------------------------
// A game
// ---------------------------------------------------------------------------

const gameListeners = new Set<(update: SantoriniGameUpdate) => void>()

onSocketCreated((socket) => {
  socket.on('connect', () => {
    for (const channel of channelsInUse()) joinAndSync(socket, channel)
  })
  socket.on('santorini:changed', ({ channel }) => notify(channel))
  socket.on('santorini:game', (update) => {
    for (const listener of gameListeners) listener(update)
  })
})

/**
 * Calls `onUpdate` with every new state of the games the reader plays (the
 * server sends them to the two players only; check `roomCode`). Keeps the
 * socket open while subscribed. Returns the function that stops.
 */
export const subscribeToGames = (
  onUpdate: (update: SantoriniGameUpdate) => void,
): (() => void) => {
  gameListeners.add(onUpdate)
  acquireSocket()
  return () => {
    gameListeners.delete(onUpdate)
    releaseSocket()
  }
}

/** A move is given up on after this long without an answer. */
const ANSWER_TIMEOUT_MS = 6000

const NO_ANSWER: SantoriniAck = {
  ok: false,
  error: 'unavailable',
  message: 'Sem resposta do servidor. Verifique a conexão e tente de novo.',
}

/**
 * Sends a game event and resolves to the server's answer, or to a refusal
 * when none comes in time. Never rejects. The new state does not come in
 * the answer: it arrives as `santorini:game`, for both players alike.
 *
 * The server knows who a socket is from its handshake. If it answers that
 * nobody is logged in, the reader may have logged in since (in another tab,
 * say): the socket connects again and the event is sent once more.
 */
const send = (
  emit: (
    socket: ReturnType<ClientSocket['timeout']>,
    done: (error: Error | null, answer: SantoriniAck) => void,
  ) => void,
): Promise<SantoriniAck> =>
  new Promise((resolve) => {
    const socket = acquireSocket()
    const attempt = (retryAsLoggedIn: boolean) => {
      emit(socket.timeout(ANSWER_TIMEOUT_MS), (error, answer) => {
        if (!error && !answer.ok && answer.error === 'login') {
          if (retryAsLoggedIn) {
            reconnectSocket()
            attempt(false)
            return
          }
        }
        releaseSocket()
        resolve(error ? NO_ANSWER : answer)
      })
    }
    attempt(true)
  })

/** Adds a step (place, select, move, build) to the player's turn. */
export const playAction = (roomCode: string, action: SantoriniActionInput) =>
  send((socket, done) =>
    socket.emit('santorini:action', roomCode, action, done),
  )

/** Ends the player's turn. */
export const commitTurn = (roomCode: string) =>
  send((socket, done) => socket.emit('santorini:commit', roomCode, done))

/** Takes back the steps of the turn that is not committed yet. */
export const undoTurn = (roomCode: string) =>
  send((socket, done) => socket.emit('santorini:undo', roomCode, done))

/** Gives up the game. */
export const resign = (roomCode: string) =>
  send((socket, done) => socket.emit('santorini:resign', roomCode, done))
