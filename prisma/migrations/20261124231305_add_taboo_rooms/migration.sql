-- CreateEnum
CREATE TYPE "TabooRoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED');

-- CreateTable
CREATE TABLE "TabooRoom" (
    "id" SERIAL NOT NULL,
    "roomCode" TEXT NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "status" "TabooRoomStatus" NOT NULL DEFAULT 'WAITING',
    "settings" JSONB NOT NULL,
    "gameState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabooRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabooRoomPlayer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "team" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TabooRoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TabooRoom_roomCode_key" ON "TabooRoom"("roomCode");

-- CreateIndex
CREATE INDEX "TabooRoom_status_idx" ON "TabooRoom"("status");

-- CreateIndex
CREATE INDEX "TabooRoomPlayer_userId_idx" ON "TabooRoomPlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TabooRoomPlayer_roomId_userId_key" ON "TabooRoomPlayer"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "TabooRoom" ADD CONSTRAINT "TabooRoom_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TabooRoomPlayer" ADD CONSTRAINT "TabooRoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TabooRoomPlayer" ADD CONSTRAINT "TabooRoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "TabooRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
