-- DropIndex
DROP INDEX "User_googleId_idx";

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
