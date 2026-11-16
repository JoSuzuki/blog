-- CreateEnum
CREATE TYPE "QuizPhase" AS ENUM ('GUESSING', 'REVEALED', 'FINISHED');

-- CreateTable
CREATE TABLE "QuizPrint" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "slots" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizPrint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizPrintImage" (
    "printId" INTEGER NOT NULL,
    "censored" BYTEA NOT NULL,
    "original" BYTEA NOT NULL,

    CONSTRAINT "QuizPrintImage_pkey" PRIMARY KEY ("printId")
);

-- CreateTable
CREATE TABLE "QuizGame" (
    "id" SERIAL NOT NULL,
    "hostId" INTEGER NOT NULL,
    "phase" "QuizPhase" NOT NULL DEFAULT 'GUESSING',
    "printIds" INTEGER[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "revealedCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizGuess" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "printId" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "person" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuizGuess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizPrint_externalId_key" ON "QuizPrint"("externalId");

-- CreateIndex
CREATE INDEX "QuizGuess_userId_idx" ON "QuizGuess"("userId");

-- CreateIndex
CREATE INDEX "QuizGuess_printId_idx" ON "QuizGuess"("printId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizGuess_gameId_printId_slot_userId_key" ON "QuizGuess"("gameId", "printId", "slot", "userId");

-- AddForeignKey
ALTER TABLE "QuizPrintImage" ADD CONSTRAINT "QuizPrintImage_printId_fkey" FOREIGN KEY ("printId") REFERENCES "QuizPrint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizGame" ADD CONSTRAINT "QuizGame_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizGuess" ADD CONSTRAINT "QuizGuess_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "QuizGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizGuess" ADD CONSTRAINT "QuizGuess_printId_fkey" FOREIGN KEY ("printId") REFERENCES "QuizPrint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizGuess" ADD CONSTRAINT "QuizGuess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

