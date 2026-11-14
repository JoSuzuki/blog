-- CreateEnum
CREATE TYPE "SantoriniRoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED');

-- CreateTable
CREATE TABLE "SantoriniRoom" (
    "id" SERIAL NOT NULL,
    "roomCode" TEXT NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "status" "SantoriniRoomStatus" NOT NULL DEFAULT 'WAITING',
    "gameState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SantoriniRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SantoriniRoomPlayer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "winner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SantoriniRoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SantoriniRoom_roomCode_key" ON "SantoriniRoom"("roomCode");

-- CreateIndex
CREATE INDEX "SantoriniRoom_status_idx" ON "SantoriniRoom"("status");

-- CreateIndex
CREATE INDEX "SantoriniRoomPlayer_userId_idx" ON "SantoriniRoomPlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SantoriniRoomPlayer_roomId_userId_key" ON "SantoriniRoomPlayer"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "SantoriniRoom" ADD CONSTRAINT "SantoriniRoom_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SantoriniRoomPlayer" ADD CONSTRAINT "SantoriniRoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SantoriniRoomPlayer" ADD CONSTRAINT "SantoriniRoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "SantoriniRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
