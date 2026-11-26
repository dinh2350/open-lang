-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('phrase', 'word', 'correction', 'missed');

-- CreateTable
CREATE TABLE "Note" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "kind" "NoteKind" NOT NULL,
    "english" TEXT NOT NULL,
    "said" TEXT,
    "meaning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_conversationId_createdAt_idx" ON "Note"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Note_conversationId_kind_english_key" ON "Note"("conversationId", "kind", "english");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
