-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "route" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faunaId" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HitCounter" (
    "route" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HitCounter_pkey" PRIMARY KEY ("route")
);

-- CreateIndex
CREATE UNIQUE INDEX "Comment_faunaId_key" ON "Comment"("faunaId");

-- CreateIndex
CREATE INDEX "Comment_route_createdAt_idx" ON "Comment"("route", "createdAt");
