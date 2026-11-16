// What the pages get about the quiz, shared by the server functions, the
// socket events and the components. No server code here: the browser bundle
// imports this module.

/** The game's name on the site and the address of its pages. */
export const QUIZ_NAME = 'Quem disse?'
export const QUIZ_PATH = '/games/quem-disse'

/** Everyone a slot can be: the choices a player picks from, in this order. */
export const QUIZ_PEOPLE = [
  'Jo',
  'Barbi',
  'Igor',
  'Mag',
  'Maimoni',
  'Matias',
  'Niels',
  'Ovo',
  'Roda',
  'Aphek',
  'Iza',
] as const

export type QuizPerson = (typeof QUIZ_PEOPLE)[number]

export const isQuizPerson = (value: unknown): value is QuizPerson =>
  (QUIZ_PEOPLE as readonly unknown[]).includes(value)

/** A slot's label is one capital letter ("Pessoa A" in the censored image). */
export const QUIZ_SLOT_PATTERN = /^[A-Z]$/

export type QuizPhase = 'GUESSING' | 'REVEALED' | 'FINISHED'

/** The two images of a print, as the image route names them. */
export type QuizImageKind = 'censurada' | 'original'

/** Where the image route serves an image of a print. */
export const quizImagePath = (printId: number, kind: QuizImageKind) =>
  `${QUIZ_PATH}/imagem/${printId}/${kind}`

/** The print on screen. Never carries who its slots are. */
export interface QuizPrintView {
  id: number
  width: number
  height: number
  /** The labels of its slots, in order: `['A', 'B']`. */
  slots: string[]
}

/** Someone who has guessed at least once in the game. */
export interface QuizPlayerView {
  userId: number
  /** First name only. */
  name: string
  /** Correct slots over the prints revealed so far. */
  score: number
  /** Whether they have picked someone for every slot of the print on screen. */
  answered: boolean
}

/** What the reveal adds: the answers and what everybody picked. */
export interface QuizRevealView {
  /** The right person per slot label. */
  answers: Record<string, string>
  guesses: {
    userId: number
    /** Slot label to the person picked (a slot left blank is missing). */
    picks: Record<string, string>
  }[]
}

/**
 * The newest game as every player may see it: the same for all of them. While
 * the phase is GUESSING it holds no answer and nobody's picks, only who has
 * answered.
 */
export interface QuizState {
  gameId: number
  /** Grows with every write to the game; with `gameId`, orders two states. */
  version: number
  phase: QuizPhase
  /** Index of the print on screen, from 0. */
  position: number
  total: number
  /** The print on screen; null once the game is FINISHED. */
  print: QuizPrintView | null
  /** Best score first. */
  players: QuizPlayerView[]
  /** Only while the phase is REVEALED. */
  reveal: QuizRevealView | null
}

/** A player's own picks for one print, which only they get before the reveal. */
export interface QuizMyGuesses {
  gameId: number
  printId: number
  /** The game's `version` when these were read. */
  version: number
  picks: Record<string, string>
}

/** Whether `a` is a later state than `b` (a newer game, or a newer write). */
export const isNewerQuiz = (
  a: { gameId: number; version: number },
  b: { gameId: number; version: number },
) => a.gameId > b.gameId || (a.gameId === b.gameId && a.version > b.version)

/** Why a quiz event was refused; `message` is ready to show. */
export interface QuizActionError {
  ok: false
  error:
    | 'not_found'
    | 'forbidden'
    | 'invalid'
    | 'conflict'
    | 'rate_limited'
    | 'unavailable'
  message: string
}

/** Answer to the quiz events. The new state is not in it: it is pushed. */
export type QuizAck = { ok: true } | QuizActionError

/** `quiz:guess`: who the player thinks a slot of the print on screen is. */
export interface QuizGuessInput {
  gameId: number
  printId: number
  slot: string
  person: string
}

/** `quiz:start`: how many prints to play; all of them when left out. */
export interface QuizStartInput {
  count?: number
}

/**
 * `quiz:reveal`, `quiz:next` and `quiz:end` say which game and print the host
 * was looking at, so a second click or a stale page changes nothing.
 */
export interface QuizHostInput {
  gameId: number
  position: number
}
