// The rules of Tabu as pure functions over a JSON game state. The server uses
// them to decide what happens; nothing here touches the database, the clock or
// randomness by itself (callers pass `now` and `random`), so the rules can be
// tested on their own. No server code: the browser bundle imports the types.
//
// How a game goes: two teams take turns. In a turn one player (the speaker)
// has `turnSeconds` to make their own team guess as many cards as they can
// without saying the card's five forbidden words. The other team sees the card
// too and buzzes "Tabu!" when a forbidden word is said. A guessed card is a
// point for the speaker's team, a buzzed one takes a point away, a skipped one
// counts nothing. Turns alternate between the teams and rotate inside each
// team until every player has spoken `roundsPerPlayer` times.

export type Team = 0 | 1
export const TEAMS: readonly Team[] = [0, 1]

/** How a card left the table. `timeout`: the turn ended while it was up. */
export type CardOutcome = 'correct' | 'skipped' | 'taboo' | 'timeout'
/** What a player can do to the card on the table. */
export type PlayedOutcome = Exclude<CardOutcome, 'timeout'>

export interface TabooSettings {
  /** How many times each player speaks (the bigger team decides the length). */
  roundsPerPlayer: number
  /** The length of a turn. */
  turnSeconds: number
}

export const ROUNDS_PER_PLAYER_OPTIONS = [1, 2, 3, 4, 5] as const
export const TURN_SECONDS_OPTIONS = [30, 45, 60, 90, 120] as const
export const DEFAULT_SETTINGS: TabooSettings = {
  roundsPerPlayer: 2,
  turnSeconds: 60,
}

/** Players per team needed to start: someone to speak and someone to guess. */
export const MIN_TEAM_SIZE = 2
/** Seats per room. */
export const MAX_PLAYERS = 16

export interface CardResult {
  cardId: number
  outcome: CardOutcome
}

export interface TurnRecord {
  /** 0-based position of the turn in the game. */
  number: number
  team: Team
  speakerId: number
  results: CardResult[]
  points: number
}

export type TurnPhase = 'ready' | 'playing' | 'over'

export interface TabooGameState {
  settings: TabooSettings
  /** Player ids per team, in speaking order. */
  teams: [number[], number[]]
  /** Turns each team has had; picks who speaks next inside the team. */
  teamTurns: [number, number]
  /** Card ids still to draw, drawn from the end. Never sent to a browser. */
  deck: number[]
  /** How many cards exist, to reshuffle when the deck runs out. */
  cardCount: number
  /** 0-based index of the current turn. */
  turnNumber: number
  totalTurns: number
  scores: [number, number]
  /**
   * `ready`: the speaker has not started the clock yet. `playing`: the clock
   * runs until `endsAt`. `over`: the last turn has ended.
   */
  phase: TurnPhase
  team: Team
  speakerId: number
  /** Epoch milliseconds, while playing. */
  endsAt: number | null
  /** The card on the table, while playing. */
  cardId: number | null
  /** Cards already played this turn. */
  results: CardResult[]
  /** Every finished turn, oldest first. */
  history: TurnRecord[]
}

export const otherTeam = (team: Team): Team => (team === 0 ? 1 : 0)

/** Fisher-Yates with the given source of randomness. */
export const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Whether teams of these sizes can start a game. */
export const canStart = (teamSizes: [number, number]) =>
  teamSizes[0] >= MIN_TEAM_SIZE && teamSizes[1] >= MIN_TEAM_SIZE

/**
 * Each team gets the same number of turns, enough for every player of the
 * bigger team to speak `roundsPerPlayer` times (players of a smaller team
 * speak a little more often).
 */
export const countTurns = (teams: [number[], number[]], rounds: number) =>
  2 * Math.max(teams[0].length, teams[1].length) * rounds

/** Who speaks for `team` on its next turn. */
export const nextSpeaker = (
  teams: [number[], number[]],
  teamTurns: [number, number],
  team: Team,
): number | undefined => {
  const players = teams[team]
  return players.length ? players[teamTurns[team] % players.length] : undefined
}

export const createGame = ({
  settings,
  teams,
  cardCount,
  random,
  firstTeam = 0,
}: {
  settings: TabooSettings
  teams: [number[], number[]]
  cardCount: number
  random: () => number
  firstTeam?: Team
}): TabooGameState => {
  const teamTurns: [number, number] = [0, 0]
  return {
    settings,
    teams: [teams[0].slice(), teams[1].slice()],
    teamTurns,
    deck: shuffle(
      Array.from({ length: cardCount }, (_, i) => i),
      random,
    ),
    cardCount,
    turnNumber: 0,
    totalTurns: countTurns(teams, settings.roundsPerPlayer),
    scores: [0, 0],
    phase: 'ready',
    team: firstTeam,
    speakerId: nextSpeaker(teams, teamTurns, firstTeam) ?? -1,
    endsAt: null,
    cardId: null,
    results: [],
    history: [],
  }
}

/**
 * Takes the next card off the deck. When the deck is empty every card goes
 * back in, shuffled, except the ones already played this turn.
 */
const draw = (
  state: TabooGameState,
  random: () => number,
): { deck: number[]; cardId: number } => {
  let deck = state.deck
  if (deck.length === 0) {
    const used = new Set(state.results.map((r) => r.cardId))
    deck = shuffle(
      Array.from({ length: state.cardCount }, (_, i) => i).filter(
        (id) => !used.has(id),
      ),
      random,
    )
    if (deck.length === 0) {
      deck = Array.from({ length: state.cardCount }, (_, i) => i)
    }
  }
  return { deck: deck.slice(0, -1), cardId: deck[deck.length - 1] }
}

/** The speaker starts the clock: the first card goes on the table. */
export const startTurn = (
  state: TabooGameState,
  now: number,
  random: () => number,
): TabooGameState => {
  const { deck, cardId } = draw(state, random)
  return {
    ...state,
    phase: 'playing',
    endsAt: now + state.settings.turnSeconds * 1000,
    deck,
    cardId,
    results: [],
  }
}

const POINTS: Record<CardOutcome, number> = {
  correct: 1,
  taboo: -1,
  skipped: 0,
  timeout: 0,
}

const pointsOf = (results: CardResult[]) =>
  results.reduce((sum, r) => sum + POINTS[r.outcome], 0)

/**
 * The card on the table was guessed, skipped or buzzed: it is scored for the
 * speaker's team and the next one is drawn.
 */
export const playCard = (
  state: TabooGameState,
  outcome: PlayedOutcome,
  random: () => number,
): TabooGameState => {
  if (state.phase !== 'playing' || state.cardId === null) return state
  const results = [...state.results, { cardId: state.cardId, outcome }]
  const scores: [number, number] = [...state.scores]
  scores[state.team] += POINTS[outcome]
  const { deck, cardId } = draw({ ...state, results }, random)
  return { ...state, results, scores, deck, cardId }
}

/**
 * Moves on to the next turn's `ready` (or to `over` after the last turn)
 * without recording anything for the current one.
 */
const advance = (state: TabooGameState): TabooGameState => {
  const turnNumber = state.turnNumber + 1
  if (turnNumber >= state.totalTurns) {
    return {
      ...state,
      turnNumber,
      phase: 'over',
      endsAt: null,
      cardId: null,
      results: [],
    }
  }
  const team = otherTeam(state.team)
  return {
    ...state,
    turnNumber,
    phase: 'ready',
    team,
    speakerId: nextSpeaker(state.teams, state.teamTurns, team) ?? -1,
    endsAt: null,
    cardId: null,
    results: [],
  }
}

/**
 * The clock ran out: the card on the table counts nothing, the turn goes into
 * the history and the other team's next speaker is up.
 */
export const endTurn = (state: TabooGameState): TabooGameState => {
  if (state.phase !== 'playing') return state
  const results =
    state.cardId === null
      ? state.results
      : [
          ...state.results,
          { cardId: state.cardId, outcome: 'timeout' as const },
        ]
  const record: TurnRecord = {
    number: state.turnNumber,
    team: state.team,
    speakerId: state.speakerId,
    results,
    points: pointsOf(results),
  }
  // The card that timed out was never seen by the speaker's team: back under
  // the deck it goes.
  const deck =
    state.cardId === null ? state.deck : [state.cardId, ...state.deck]
  const teamTurns: [number, number] = [...state.teamTurns]
  teamTurns[state.team] += 1
  return advance({
    ...state,
    deck,
    teamTurns,
    history: [...state.history, record],
  })
}

/**
 * Hands the turn that has not started to the next player of the same team
 * (the speaker is away). Returns null when nobody else on the team can.
 */
export const passSpeaker = (state: TabooGameState): TabooGameState | null => {
  if (state.phase !== 'ready' || state.teams[state.team].length < 2) return null
  const teamTurns: [number, number] = [...state.teamTurns]
  teamTurns[state.team] += 1
  return {
    ...state,
    teamTurns,
    speakerId: nextSpeaker(state.teams, teamTurns, state.team) ?? -1,
  }
}

/** A player who arrives during the game joins the smaller team. */
export const addPlayer = (
  state: TabooGameState,
  playerId: number,
  team?: Team,
): TabooGameState => {
  if (state.teams.some((players) => players.includes(playerId))) return state
  const joinTeam: Team =
    team ?? (state.teams[0].length <= state.teams[1].length ? 0 : 1)
  const teams: [number[], number[]] = [
    state.teams[0].slice(),
    state.teams[1].slice(),
  ]
  teams[joinTeam].push(playerId)
  return { ...state, teams }
}

/**
 * A player left. If they were about to speak, their teammate does; if they
 * were speaking, the turn ends now. A team left without players ends the game.
 */
export const removePlayer = (
  state: TabooGameState,
  playerId: number,
): TabooGameState => {
  const teams: [number[], number[]] = [
    state.teams[0].filter((id) => id !== playerId),
    state.teams[1].filter((id) => id !== playerId),
  ]
  let next: TabooGameState = { ...state, teams }
  if (state.phase === 'over') return next
  if (teams[0].length === 0 || teams[1].length === 0) {
    return {
      ...next,
      phase: 'over',
      endsAt: null,
      cardId: null,
      results: [],
    }
  }
  if (state.speakerId !== playerId) return next
  if (state.phase === 'playing') {
    next = endTurn(next)
    return next
  }
  return {
    ...next,
    speakerId: nextSpeaker(teams, state.teamTurns, state.team) ?? -1,
  }
}

/** The winning team, `tie`, or null while the game goes on. */
export const winnerOf = (state: TabooGameState): Team | 'tie' | null => {
  if (state.phase !== 'over') return null
  if (state.scores[0] === state.scores[1]) return 'tie'
  return state.scores[0] > state.scores[1] ? 0 : 1
}

/** Whether `playerId` sees the card on the table: the speaker and the other team. */
export const seesCard = (state: TabooGameState, playerId: number | null) =>
  playerId !== null &&
  (playerId === state.speakerId ||
    state.teams[otherTeam(state.team)].includes(playerId))

export const teamOf = (
  state: Pick<TabooGameState, 'teams'>,
  playerId: number | null,
): Team | null => {
  if (playerId === null) return null
  if (state.teams[0].includes(playerId)) return 0
  if (state.teams[1].includes(playerId)) return 1
  return null
}

/**
 * Small grace periods around the end of a turn: a click sent just before the
 * buzzer still counts, and a browser whose clock is slightly ahead can already
 * end the turn.
 */
export const LATE_PLAY_GRACE_MS = 600
export const EARLY_END_GRACE_MS = 400
