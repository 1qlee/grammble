-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "confirmAllGuesses" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "colorBlindMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reduceMotion" BOOLEAN NOT NULL DEFAULT false;
