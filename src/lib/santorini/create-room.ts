import { randomInt } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { takeRateLimit } from '~/lib/rate-limit.server'
import type { RoomActionError } from './room'
import {
  LOGIN_REQUIRED,
  announce,
  findActiveRoomCode,
  refuse,
  refused,
} from './room.server'

const CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Opens a Santorini room with the reader in its first seat and resolves to
 * its code. A reader sits in one unfinished room at a time: if they already
 * have one, that room's code is the answer and nothing is created.
 */
export const createRoom = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ ok: true; roomCode: string } | RoomActionError> => {
    // 1. Who is asking.
    const user = await getCurrentUser()
    if (!user) return refused(LOGIN_REQUIRED)

    // 2. Rate limit: 10 rooms per 10 minutes per client address.
    const limited = takeRateLimit('santorini-create-room', getRequest(), {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    })
    if (!limited.allowed) {
      return refused(
        refuse(
          'rate_limited',
          'Muitas salas em pouco tempo. Tente mais tarde.',
        ),
      )
    }

    // 3. One unfinished room per reader.
    const activeRoomCode = await findActiveRoomCode(user.id)
    if (activeRoomCode) return { ok: true, roomCode: activeRoomCode }

    // 4. Create it under a random code; on the rare collision, draw again.
    for (let attempt = 0; ; attempt++) {
      const roomCode = Array.from(
        { length: 6 },
        () => CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)],
      ).join('')
      try {
        await prisma.santoriniRoom.create({
          data: {
            roomCode,
            creatorId: user.id,
            players: { create: { userId: user.id } },
          },
        })
        // 5. The list of rooms has a new entry.
        announce(null, true)
        return { ok: true, roomCode }
      } catch (error) {
        const collision = (error as { code?: string } | null)?.code === 'P2002'
        if (!collision || attempt >= 4) throw error
      }
    }
  },
)
