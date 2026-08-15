-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('SIX', 'SEVEN', 'EIGHT');

-- DropIndex
DROP INDEX "puzzle_date_key";

-- DropIndex
DROP INDEX "puzzle_number_key";

-- AlterTable
ALTER TABLE "game_session" ADD COLUMN     "score" INTEGER;

-- AlterTable
ALTER TABLE "gram" DROP COLUMN "guessWordCount";

-- AlterTable
ALTER TABLE "puzzle" ADD COLUMN     "difficulty" "Difficulty" NOT NULL,
ADD COLUMN     "guessWordCount" INTEGER NOT NULL,
ADD COLUMN     "mode" "GameMode" NOT NULL;

-- CreateTable
CREATE TABLE "user_stats" (
    "userId" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "maxStreak" INTEGER NOT NULL DEFAULT 0,
    "distribution" INTEGER[] DEFAULT ARRAY[0, 0, 0, 0, 0, 0]::INTEGER[],
    "lastPuzzleNumber" INTEGER,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("userId","mode")
);

-- CreateIndex
CREATE INDEX "puzzle_date_idx" ON "puzzle"("date");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_date_mode_key" ON "puzzle"("date", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_number_mode_key" ON "puzzle"("number", "mode");

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
