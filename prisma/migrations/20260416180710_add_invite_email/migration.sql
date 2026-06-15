/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `invite` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "invite" ADD COLUMN     "email" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "invite_email_key" ON "invite"("email");
