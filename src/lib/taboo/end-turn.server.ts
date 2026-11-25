import type { TabooAck } from '~/lib/realtime/events'
import { EARLY_END_GRACE_MS, endTurn as end } from './game'
import { commitGame, findSeatInGame, refuse } from './room.server'

/**
 * The `taboo:time-up` socket event: a player's timer reached zero. The server
 * keeps no timers of its own; every player's page sends this when the clock
 * runs out, the first one ends the turn and the others find it already ended.
 * The server's clock decides whether the time is really up.
 */
export const endTurn = async (
  userId: number,
  roomCode: unknown,
  turnNumber: unknown,
): Promise<TabooAck> => {
  // 1. The player's seat in the running game.
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState } = seat

  // 2. Already ended (by someone else's page) is fine.
  if (gameState.phase !== 'playing' || gameState.turnNumber !== turnNumber) {
    return { ok: true }
  }
  if (
    gameState.endsAt === null ||
    Date.now() < gameState.endsAt - EARLY_END_GRACE_MS
  ) {
    return refuse('invalid', 'Ainda há tempo.')
  }

  // 3. End it and push to everyone.
  const answer = await commitGame(room, end(gameState))
  // Another page ended it at the same moment: that is the same result.
  return answer.ok || answer.error === 'conflict' ? { ok: true } : answer
}
