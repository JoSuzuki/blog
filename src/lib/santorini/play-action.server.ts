import { z } from 'zod'
import type { SantoriniAck } from '~/lib/realtime/events'
import {
  BOARD_SIZE,
  applyTurnActions,
  canExecuteAction,
  getNextActionType,
  passTurn,
  verifyWinningMove,
} from './game'
import type { Action, GameState } from './game'
import {
  NOT_YOUR_TURN,
  ROOM_CHANGED,
  findSeatInGame,
  refuse,
  saveGame,
  sendToPlayers,
} from './room.server'

const coordinate = z
  .number()
  .int()
  .min(0)
  .max(BOARD_SIZE - 1)

const actionSchema = z.object({
  type: z.enum([
    'place_worker',
    'select_worker',
    'move_worker',
    'build_from_worker',
  ]),
  tile: z.object({ x: coordinate, y: coordinate }),
})

/**
 * The `santorini:action` socket event: adds one step to the player's turn
 * (placing a worker, selecting one, moving it or building). The step stays
 * pending (it can be undone) until the turn is committed, with one
 * exception: moving up to the third level wins the game on the spot.
 */
export const playAction = async (
  userId: number,
  roomCode: unknown,
  input: unknown,
): Promise<SantoriniAck> => {
  // 1. Validate, and find the player's seat in the running game.
  const parsed = actionSchema.safeParse(input)
  if (!parsed.success) return refuse('invalid', 'Jogada inválida.')
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState, playerId } = seat

  // 2. The rules: it must be this player's turn, this must be the step the
  // turn is waiting for, and it must be legal on the board as it looks with
  // the steps already taken this turn.
  const nextActionType = getNextActionType(gameState, playerId)
  if (nextActionType === null) return NOT_YOUR_TURN
  const action: Action = { ...parsed.data, playerId }
  if (!canExecuteAction(applyTurnActions(gameState), action, nextActionType)) {
    return refuse('invalid', 'Jogada inválida.')
  }

  // 3. Add it to the turn. A winning move ends the game right away.
  const played: GameState = {
    ...gameState,
    currentTurn: {
      ...gameState.currentTurn,
      actions: [...gameState.currentTurn.actions, action],
    },
  }
  const update = verifyWinningMove(played)
    ? await saveGame(room, passTurn(played, playerId), playerId)
    : await saveGame(room, played)
  if (!update) return ROOM_CHANGED

  // 4. Both players' boards get the new state.
  sendToPlayers(room, update)
  return { ok: true }
}
