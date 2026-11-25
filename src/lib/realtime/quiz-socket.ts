import {
  acquireSocket,
  onSocketCreated,
  releaseSocket,
  whenSocketReady,
} from './connection'
import type { ClientSocket } from './connection'
import type {
  QuizAck,
  QuizGuessInput,
  QuizHostInput,
  QuizMyGuesses,
  QuizStartInput,
  QuizState,
} from '~/lib/quiz/quiz'

// The quiz over the page's shared socket. There is nothing to join: the
// server pushes the game to the readers who may play (their own rooms, which
// a socket is in from its handshake) and decides that anew on every push.
// What a player or the host does goes out as an event answered by an ack; the
// new state comes back to everyone as `quiz:state`.

export interface QuizSubscription {
  /** The game changed. */
  onState: (state: QuizState) => void
  /** The reader's own picks for the print on screen changed (any tab). */
  onMine: (mine: QuizMyGuesses) => void
  /**
   * The socket (re)connected, or was already connected when the page
   * subscribed: pushes sent before that were missed, so run the loader again.
   */
  onSync: () => void
}

const subscriptions = new Set<QuizSubscription>()

onSocketCreated((socket) => {
  socket.on('connect', () => {
    for (const sub of subscriptions) sub.onSync()
  })
  socket.on('quiz:state', (state) => {
    for (const sub of subscriptions) sub.onState(state)
  })
  socket.on('quiz:mine', (mine) => {
    for (const sub of subscriptions) sub.onMine(mine)
  })
})

/** Receives the quiz's pushes while subscribed. Returns the function that stops. */
export const subscribeToQuiz = (handlers: QuizSubscription): (() => void) => {
  subscriptions.add(handlers)
  const socket = acquireSocket()
  // Otherwise the 'connect' handler above does it.
  if (socket?.connected) handlers.onSync()
  return () => {
    subscriptions.delete(handlers)
    releaseSocket()
  }
}

/** An event is given up on after this long without an answer. */
const ANSWER_TIMEOUT_MS = 6000

const NO_ANSWER: QuizAck = {
  ok: false,
  error: 'unavailable',
  message: 'Sem resposta do servidor. Verifique a conexão e tente de novo.',
}

/**
 * Sends a quiz event and resolves to the server's answer, or to a refusal
 * when none comes in time. Never rejects.
 */
const send = (
  emit: (
    socket: ReturnType<ClientSocket['timeout']>,
    done: (error: Error | null, answer: QuizAck) => void,
  ) => void,
): Promise<QuizAck> =>
  new Promise((resolve) => {
    acquireSocket()
    void whenSocketReady().then((socket) => {
      if (!socket) {
        releaseSocket()
        resolve(NO_ANSWER)
        return
      }
      emit(socket.timeout(ANSWER_TIMEOUT_MS), (error, answer) => {
        releaseSocket()
        resolve(error ? NO_ANSWER : answer)
      })
    })
  })

/** Picks who a slot of the print on screen is. */
export const submitGuess = (input: QuizGuessInput) =>
  send((socket, done) => socket.emit('quiz:guess', input, done))

/** Host: starts a game. */
export const startGame = (input: QuizStartInput) =>
  send((socket, done) => socket.emit('quiz:start', input, done))

/** Host: reveals the print on screen. */
export const revealPrint = (input: QuizHostInput) =>
  send((socket, done) => socket.emit('quiz:reveal', input, done))

/** Host: moves on to the next print. */
export const nextPrint = (input: QuizHostInput) =>
  send((socket, done) => socket.emit('quiz:next', input, done))

/** Host: ends the game. */
export const endGame = (input: Pick<QuizHostInput, 'gameId'>) =>
  send((socket, done) => socket.emit('quiz:end', input, done))
