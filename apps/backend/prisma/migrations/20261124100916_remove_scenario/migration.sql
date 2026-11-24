-- The old role-play Conversations are not tutoring sessions: delete them,
-- which cascades to their turns, misses, notes and reports.
DELETE FROM "Conversation";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "scenarioId",
DROP COLUMN "speed";
