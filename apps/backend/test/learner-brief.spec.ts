import { LEARNER_BRIEF_LIMITS, type AuthResponse } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../src/generated/prisma/client.js';
import { LearnerService } from '../src/learner/learner.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { day, learnerItemData } from './support/learner.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

describe('Building the learner brief', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let service: LearnerService;
  let ada: AuthResponse;

  beforeEach(async () => {
    app = await startTestApp();
    prisma = app.get(PrismaService);
    service = app.get(LearnerService);
    ada = await registerUser(app, 'ada@example.test');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await stopTestApp(app);
  });

  /**
   * Gives the User `count` items, each with its own key and its own
   * `lastSeenAt` (a second after the previous one: the higher the index, the
   * more recently seen), then `overrides`.
   */
  async function createItems(
    userId: string,
    count: number,
    overrides: Partial<Prisma.LearnerItemUncheckedCreateInput> = {},
  ): Promise<void> {
    await prisma.learnerItem.createMany({
      data: Array.from({ length: count }, (_, index) =>
        learnerItemData(userId, {
          key: `item ${String(index)}`,
          english: `item ${String(index)}`,
          lastSeenAt: new Date(day(0).getTime() + index * 1000),
          ...overrides,
        }),
      ),
    });
  }

  it("lists a new User's brief as empty", async () => {
    await expect(service.briefFor(ada.user.id)).resolves.toEqual({
      version: 1,
      items: [],
    });
  });

  it('lists only the English, the meaning and the status of an item', async () => {
    await prisma.learnerItem.create({
      data: learnerItemData(ada.user.id, {
        english: 'deadline',
        meaning: 'hạn chót',
        intervalDays: 1,
        dueAt: day(1),
      }),
    });

    await expect(service.briefFor(ada.user.id, day(0))).resolves.toEqual({
      version: 1,
      items: [{ english: 'deadline', meaning: 'hạn chót', status: 'learning' }],
    });
  });

  it('lists the 40 most recently seen items, newest first', async () => {
    await createItems(ada.user.id, 45);

    const brief = await service.briefFor(ada.user.id);

    expect(LEARNER_BRIEF_LIMITS.items).toBe(40);
    const english = brief.items.map((item) => item.english);
    expect(english).toHaveLength(40);
    expect(english[0]).toBe('item 44');
    expect(english[39]).toBe('item 5');
    expect(english).toEqual(
      Array.from({ length: 40 }, (_, index) => `item ${String(44 - index)}`),
    );
  });

  it('puts items seen at the same time in the order of their ids', async () => {
    for (const key of ['agenda', 'minutes', 'deadline']) {
      await prisma.learnerItem.create({
        data: learnerItemData(ada.user.id, {
          key,
          english: key,
          lastSeenAt: day(0),
        }),
      });
    }
    const stored = await prisma.learnerItem.findMany();
    const byId = stored.toSorted((a, b) => (a.id < b.id ? -1 : 1));

    const brief = await service.briefFor(ada.user.id);

    expect(brief.items.map((item) => item.english)).toEqual(
      byId.map((item) => item.english),
    );
  });

  it('shows a mastered item neglected for more than one interval as learning', async () => {
    await prisma.learnerItem.create({
      data: learnerItemData(ada.user.id, {
        english: 'deadline',
        meaning: 'hạn chót',
        intervalDays: 8,
        dueAt: day(15),
      }),
    });

    const onTime = await service.briefFor(ada.user.id, day(23));
    const neglected = await service.briefFor(
      ada.user.id,
      new Date(day(23).getTime() + 1),
    );

    expect(onTime.items).toEqual([
      { english: 'deadline', meaning: 'hạn chót', status: 'mastered' },
    ]);
    expect(neglected.items).toEqual([
      { english: 'deadline', meaning: 'hạn chót', status: 'learning' },
    ]);
  });

  it('shows an item with an interval under 7 days as learning, however recent', async () => {
    await prisma.learnerItem.create({
      data: learnerItemData(ada.user.id, { intervalDays: 4, dueAt: day(4) }),
    });

    const brief = await service.briefFor(ada.user.id, day(5));

    expect(brief.items).toEqual([
      expect.objectContaining({ status: 'learning' }),
    ]);
  });

  it('drops items until the brief fits in 4096 bytes', async () => {
    await createItems(ada.user.id, 30, {
      english: 'e'.repeat(120),
      meaning: 'm'.repeat(120),
    });

    const brief = await service.briefFor(ada.user.id);

    expect(Buffer.byteLength(JSON.stringify(brief))).toBeLessThanOrEqual(
      LEARNER_BRIEF_LIMITS.bytes,
    );
    expect(brief.items.length).toBeGreaterThan(0);
    expect(brief.items.length).toBeLessThan(30);
  });

  it('drops the least recently seen items first, and no more than it must', async () => {
    await createItems(ada.user.id, 30, {
      english: 'e'.repeat(120),
      meaning: 'm'.repeat(120),
    });

    const brief = await service.briefFor(ada.user.id);

    // Every item, newest first: the brief keeps the start of this list.
    const everyItem = (
      await prisma.learnerItem.findMany({ orderBy: { lastSeenAt: 'desc' } })
    ).map(({ english, meaning }) => ({ english, meaning, status: 'learning' }));
    expect(brief.items).toEqual(everyItem.slice(0, brief.items.length));
    const oneMore = {
      ...brief,
      items: everyItem.slice(0, brief.items.length + 1),
    };
    expect(Buffer.byteLength(JSON.stringify(oneMore))).toBeGreaterThan(
      LEARNER_BRIEF_LIMITS.bytes,
    );
  });

  it('counts the bytes of the text, not its characters', async () => {
    await createItems(ada.user.id, 30, {
      english: 'e'.repeat(120),
      meaning: 'ạ'.repeat(120),
    });

    const brief = await service.briefFor(ada.user.id);

    expect(Buffer.byteLength(JSON.stringify(brief))).toBeLessThanOrEqual(
      LEARNER_BRIEF_LIMITS.bytes,
    );
    expect(brief.items.length).toBeGreaterThan(0);
  });

  it("keeps each User's items apart", async () => {
    const grace = await registerUser(app, 'grace@example.test');
    await prisma.learnerItem.create({
      data: learnerItemData(ada.user.id, {
        key: 'agenda',
        english: 'agenda',
        lastSeenAt: day(1),
      }),
    });
    await prisma.learnerItem.create({
      data: learnerItemData(grace.user.id, {
        key: 'minutes',
        english: 'minutes',
        lastSeenAt: day(2),
      }),
    });

    const adas = await service.briefFor(ada.user.id);
    const graces = await service.briefFor(grace.user.id);

    expect(adas.items.map((item) => item.english)).toEqual(['agenda']);
    expect(graces.items.map((item) => item.english)).toEqual(['minutes']);
  });

  it('rejects when the database fails, so the caller can go without a brief', async () => {
    vi.spyOn(prisma.learnerItem, 'findMany').mockRejectedValueOnce(
      new Error('db'),
    );

    await expect(service.briefFor(ada.user.id)).rejects.toThrow('db');
  });
});
