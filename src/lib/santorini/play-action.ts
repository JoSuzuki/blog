import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  BOARD_SIZE,
  applyTurnActions,
  canExecuteAction,
  passTurn,
  getNextActionType,
  verifyWinningMove,
} from './game'
import type { Action, GameState } from './game'
import type { RoomActionError } from './room'
import {
  NOT_YOUR_TURN,
  ROOM_CHANGED,
  announce,
  findSeatInGame,
  refuse,
  refused,
  saveGame,
} from './room.server'

const coordinate = z
  .number()
  .int()
  .min(0)
  .max(BOARD_SIZE - 1)

const inputSchema = z.object({
  type: z.enum([
    'place_worker',
    'select_worker',
    'move_worker',
    'build_from_worker',
  ]),
  tile: z.object({ x: coordinate, y: coordinate }),
})

interface PlayActionInput {
  roomCode: string
  type: Exclude<Action['type'], 'commit_actions'>
  tile: { x: number; y: number }
}

/**
 * Adds one step to the reader's turn: placing a worker, selecting one,
 * moving it or building. The step stays pending (it can be undone) until the
 * turn is committed, with one exception: moving up to the third level wins
 * the game on the spot.
 */
export const playAction = createServerFn({ method: 'POST' })
  .validator((data: PlayActionInput) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. Validate, and find the reader's seat in the running game.
    const input = inputSchema.safeParse(data)
    if (!input.success) return refused(refuse('invalid', 'Jogada inválida.'))
    const seat = await findSeatInGame(data)
    if ('ok' in seat) return refused(seat)
    const { room, gameState, playerId } = seat

    // 2. The rules: it must be this player's turn, this must be the step the
    // turn is waiting for, and it must be legal on the board as it looks
    // with the steps already taken this turn.
    const nextActionType = getNextActionType(gameState, playerId)
    if (nextActionType === null) return refused(NOT_YOUR_TURN)
    const action: Action = { ...input.data, playerId }
    if (
      !canExecuteAction(applyTurnActions(gameState), action, nextActionType)
    ) {
      return refused(refuse('invalid', 'Jogada inválida.'))
    }

    // 3. Add it to the turn. A winning move ends the game right away.
    const played: GameState = {
      ...gameState,
      currentTurn: {
        ...gameState.currentTurn,
        actions: [...gameState.currentTurn.actions, action],
      },
    }
    const saved = verifyWinningMove(played)
      ? await saveGame(room, passTurn(played, playerId), playerId)
      : await saveGame(room, played)
    if (!saved) return refused(ROOM_CHANGED)

    // 4. Both players' boards load the new state.
    announce(room.roomCode)
    return { ok: true }
  })
