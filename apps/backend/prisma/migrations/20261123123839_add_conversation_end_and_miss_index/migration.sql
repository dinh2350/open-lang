-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Miss_conversationId_idx" ON "Miss"("conversationId");
