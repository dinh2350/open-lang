-- CreateEnum
CREATE TYPE "LearnerItemKind" AS ENUM ('phrase', 'word');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "learnerUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LearnerItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "LearnerItemKind" NOT NULL,
    "english" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "correctRecalls" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LearnerItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnerItem_userId_lastSeenAt_idx" ON "LearnerItem"("userId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerItem_userId_key_key" ON "LearnerItem"("userId", "key");

-- AddForeignKey
ALTER TABLE "LearnerItem" ADD CONSTRAINT "LearnerItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
