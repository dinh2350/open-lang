import type { Note, User } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { ConversationsService } from '../../src/conversations/conversations.service.js';
import type { Prisma } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { ingestNote, ingestTurn } from './conversations.js';

const MILLISECONDS_PER_DAY = 86_400_000;

/** `n` days after 00:00 UTC on the day of the tests; `n` may be a fraction. */
export const day = (n: number): Date =>
  new Date(Date.UTC(2026, 10, 23) + n * MILLISECONDS_PER_DAY);

/**
 * Records a Conversation of the User in the room that took place at `at`,
 * with its Notes and turns (one second apart from `at`), and marks it ended.
 * The end is written to the table, not posted as the Agent's end marker, so
 * nothing starts in the background.
 */
export async function endedConversation(
  app: INestApplication<App>,
  user: User,
  conversation: {
    readonly room: string;
    readonly at: Date;
    readonly notes: readonly Note[];
    readonly turns?: readonly { role: 'agent' | 'user'; text: string }[];
  },
): Promise<void> {
  const { room, at, notes, turns = [] } = conversation;
  await app.get(ConversationsService).create(user, room);
  for (const note of notes) await ingestNote(app, room, note);
  for (const [index, turn] of turns.entries()) {
    await ingestTurn(app, room, {
      itemId: `item-${String(index)}`,
      ...turn,
      startedAt: new Date(at.getTime() + index * 1000).toISOString(),
    });
  }
  await app.get(PrismaService).conversation.update({
    where: { roomName: room },
    data: {
      createdAt: at,
      endedAt: new Date(at.getTime() + turns.length * 1000),
    },
  });
}

/** A whole LearnerItem of the User, the word "deadline" taught on day 0. */
export function learnerItemData(
  userId: string,
  overrides: Partial<Prisma.LearnerItemUncheckedCreateInput> = {},
): Prisma.LearnerItemUncheckedCreateInput {
  return {
    userId,
    kind: 'word',
    english: 'deadline',
    meaning: 'hạn chót',
    key: 'deadline',
    firstSeenAt: day(0),
    lastSeenAt: day(0),
    intervalDays: 1,
    dueAt: day(1),
    ...overrides,
  };
}
