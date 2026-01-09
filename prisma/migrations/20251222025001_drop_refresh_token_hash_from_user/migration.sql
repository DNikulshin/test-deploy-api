/*
  Warnings:

  - You are about to drop the column `refreshTokenHash` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "RefreshToken_userId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "refreshTokenHash";

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;