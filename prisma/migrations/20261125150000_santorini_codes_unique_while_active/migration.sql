-- A room code is unique among the rooms still in use (WAITING or PLAYING)
-- only: a finished game keeps its code for history, and the code can be
-- drawn again for a new room. A finished game is identified by its id.
-- DropIndex
DROP INDEX "SantoriniRoom_roomCode_key";

-- CreateIndex
CREATE INDEX "SantoriniRoom_roomCode_id_idx" ON "SantoriniRoom"("roomCode", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SantoriniRoom_active_roomCode_key" ON "SantoriniRoom"("roomCode") WHERE (status IN ('WAITING', 'PLAYING'));

