import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConversationsService } from '../src/conversations/conversations.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

const item = (userId: string, key = 'deadline') => ({
  userId,
  key,
  kind: 'word' as const,
  english: 'deadline',
  meaning: 'hạn chót',
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
  intervalDays: 1,
  dueAt: new Date(),
});

describe('The LearnerItem table', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await startTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('refuses two items with the same key for one User', async () => {
    const { user } = await registerUser(app);
    await prisma.learnerItem.create({ data: item(user.id) });

    await expect(
      prisma.learnerItem.create({ data: item(user.id) }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same key for two Users', async () => {
    const ada = await registerUser(app, 'ada@example.test');
    const grace = await registerUser(app, 'grace@example.test');

    await prisma.learnerItem.create({ data: item(ada.user.id) });
    await prisma.learnerItem.create({ data: item(grace.user.id) });

    await expect(prisma.learnerItem.count()).resolves.toBe(2);
  });

  it("deletes a User's items with the User", async () => {
    const { user } = await registerUser(app);
    await prisma.learnerItem.create({ data: item(user.id) });
    await prisma.learnerItem.create({ data: item(user.id, 'schedule') });

    await prisma.user.delete({ where: { id: user.id } });

    await expect(prisma.learnerItem.count()).resolves.toBe(0);
  });

  it('keeps the counts of recalls and lapses at zero until the User is tested', async () => {
    const { user } = await registerUser(app);

    const created = await prisma.learnerItem.create({ data: item(user.id) });

    expect(created).toMatchObject({ correctRecalls: 0, lapses: 0 });
  });

  it('starts every Conversation unprocessed', async () => {
    const { user } = await registerUser(app);
    await app.get(ConversationsService).create(user, 'room-under-test');

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { roomName: 'room-under-test' },
    });

    expect(conversation.learnerUpdatedAt).toBeNull();
  });
});
