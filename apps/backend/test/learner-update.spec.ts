import type { AuthResponse, Note } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeLearnerModel } from '../src/learner/fake-learner-model.js';
import {
  LEARNER_MODEL,
  type LearnerJudgeInput,
  type LearnerJudgment,
} from '../src/learner/learner-model.js';
import { LearnerService } from '../src/learner/learner.service.js';
import { normalizeKey } from '../src/learner/spacing.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { day, endedConversation, learnerItemData } from './support/learner.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

const PHRASE: Note = {
  kind: 'phrase',
  english: "I'd like to reschedule the meeting.",
  meaning: 'Tôi muốn dời cuộc họp.',
  said: null,
};
const PHRASE_KEY = normalizeKey(PHRASE.english);
const WORD: Note = {
  kind: 'word',
  english: 'deadline',
  meaning: 'hạn chót',
  said: null,
};
const CORRECTION: Note = {
  kind: 'correction',
  english: 'I have worked here for two years.',
  said: 'I work here since two years.',
  meaning: 'Dùng thì hiện tại hoàn thành với "for".',
};
const TURNS = [
  { role: 'agent', text: 'Shall we talk about your week?' },
  { role: 'user', text: PHRASE.english },
] as const;

const HOUR_MS = 3_600_000;
const NOTHING: LearnerJudgment = { matches: [], outcomes: [] };

describe('Updating the learner profile from ended Conversations', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let service: LearnerService;
  let model: FakeLearnerModel;
  let ada: AuthResponse;

  beforeEach(async () => {
    model = new FakeLearnerModel();
    app = await startTestApp({}, (builder) =>
      builder.overrideProvider(LEARNER_MODEL).useValue(model),
    );
    prisma = app.get(PrismaService);
    service = app.get(LearnerService);
    ada = await registerUser(app, 'ada@example.test');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await stopTestApp(app);
  });

  /** The model's inputs, judging nothing. */
  function spy(): LearnerJudgeInput[] {
    const inputs: LearnerJudgeInput[] = [];
    model.script = (input) => {
      inputs.push(input);
      return NOTHING;
    };
    return inputs;
  }

  /** Ada's first Conversation, on day 0, taught the phrase; processed on day 1. */
  async function taughtPhrase(): Promise<void> {
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE],
    });
    await service.processPending(ada.user.id, day(1));
  }

  const itemOf = (key: string) =>
    prisma.learnerItem.findUniqueOrThrow({
      where: { userId_key: { userId: ada.user.id, key } },
    });

  const processedAt = async (room: string) =>
    (await prisma.conversation.findUniqueOrThrow({ where: { roomName: room } }))
      .learnerUpdatedAt;

  it('creates a learning item with a 1-day interval from each note of an ended Conversation', async () => {
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE, WORD, CORRECTION],
    });

    await service.processPending(ada.user.id, day(1));

    const common = {
      userId: ada.user.id,
      intervalDays: 1,
      firstSeenAt: day(0),
      lastSeenAt: day(0),
      dueAt: day(1),
      correctRecalls: 0,
      lapses: 0,
    };
    const items = await prisma.learnerItem.findMany({
      orderBy: { key: 'asc' },
    });
    expect(items).toEqual([
      expect.objectContaining({
        ...common,
        kind: 'word',
        key: 'deadline',
        english: 'deadline',
        meaning: 'hạn chót',
      }),
      expect.objectContaining({
        ...common,
        kind: 'phrase',
        key: 'i have worked here for two years',
        english: CORRECTION.english,
        meaning: CORRECTION.meaning,
      }),
      expect.objectContaining({
        ...common,
        kind: 'phrase',
        key: PHRASE_KEY,
        english: PHRASE.english,
        meaning: PHRASE.meaning,
      }),
    ]);
    expect(PHRASE_KEY).toBe("i'd like to reschedule the meeting");
    expect(await processedAt('r1')).toEqual(day(1));
  });

  it('does nothing for a Conversation that has not ended', async () => {
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE],
    });
    await prisma.conversation.update({
      where: { roomName: 'r1' },
      data: { endedAt: null },
    });

    await service.processPending(
      ada.user.id,
      new Date(day(0).getTime() + HOUR_MS),
    );

    expect(await prisma.learnerItem.count()).toBe(0);
    expect(await processedAt('r1')).toBeNull();
  });

  it('treats a Conversation with no end marker as ended after 6 hours', async () => {
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE],
    });
    await prisma.conversation.update({
      where: { roomName: 'r1' },
      data: { endedAt: null },
    });

    await service.processPending(
      ada.user.id,
      new Date(day(0).getTime() + 6 * HOUR_MS),
    );
    expect(await prisma.learnerItem.count()).toBe(0);

    await service.processPending(
      ada.user.id,
      new Date(day(0).getTime() + 6 * HOUR_MS + 60_000),
    );
    expect(await prisma.learnerItem.count()).toBe(1);
    expect(await processedAt('r1')).not.toBeNull();
  });

  it('skips a Conversation with neither turns nor Notes', async () => {
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [],
    });

    await service.processPending(ada.user.id, day(1));

    expect(await processedAt('r1')).toBeNull();
  });

  it('processes a Conversation once', async () => {
    await taughtPhrase();
    const script = vi.fn(({ items }: LearnerJudgeInput): LearnerJudgment => ({
      matches: [],
      outcomes: [{ itemId: items[0]?.id ?? '', outcome: 'recalled' }],
    }));
    model.script = script;
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [WORD],
      turns: TURNS,
    });

    await Promise.all([
      service.processPending(ada.user.id, day(2)),
      service.processPending(ada.user.id, day(2)),
    ]);
    await service.processPending(ada.user.id, day(3));
    await service.processPending(ada.user.id, day(3));

    expect(script).toHaveBeenCalledTimes(1);
    expect(await prisma.learnerItem.count()).toBe(2);
    expect(await itemOf(PHRASE_KEY)).toMatchObject({
      intervalDays: 2,
      correctRecalls: 1,
      dueAt: day(3),
    });
    expect(await processedAt('r2')).toEqual(day(2));
  });

  it('a note with the key of an existing item is a re-teaching', async () => {
    await taughtPhrase();
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(3),
      notes: [
        { ...PHRASE, english: "  I'd LIKE to reschedule   the meeting!" },
      ],
    });

    await service.processPending(ada.user.id, day(4));

    expect(await prisma.learnerItem.count()).toBe(1);
    expect(await itemOf(PHRASE_KEY)).toMatchObject({
      english: PHRASE.english,
      intervalDays: 1,
      dueAt: day(1),
      firstSeenAt: day(0),
      lastSeenAt: day(3),
    });
  });

  it('a recalled judgment on a due item doubles its interval', async () => {
    await taughtPhrase();
    model.script = ({ items }) => ({
      matches: [],
      outcomes: [{ itemId: items[0]?.id ?? '', outcome: 'recalled' }],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [],
      turns: [{ role: 'user', text: PHRASE.english }],
    });

    await service.processPending(ada.user.id, day(2));

    expect(await prisma.learnerItem.findFirstOrThrow()).toMatchObject({
      intervalDays: 2,
      correctRecalls: 1,
      lapses: 0,
      lastSeenAt: day(1),
      dueAt: day(3),
    });
  });

  it('a recalled judgment before the item is due changes only lastSeenAt', async () => {
    await taughtPhrase();
    model.script = ({ items }) => ({
      matches: [],
      outcomes: [{ itemId: items[0]?.id ?? '', outcome: 'recalled' }],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(0.5),
      notes: [],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(2));

    expect(await prisma.learnerItem.findFirstOrThrow()).toMatchObject({
      intervalDays: 1,
      correctRecalls: 0,
      lapses: 0,
      lastSeenAt: day(0.5),
      dueAt: day(1),
    });
  });

  it('a missed judgment resets it to 1 day and counts a lapse', async () => {
    await taughtPhrase();
    await prisma.learnerItem.updateMany({
      data: { intervalDays: 4, dueAt: day(4) },
    });
    model.script = ({ items }) => ({
      matches: [],
      outcomes: [{ itemId: items[0]?.id ?? '', outcome: 'missed' }],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(5),
      notes: [],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(6));

    expect(await prisma.learnerItem.findFirstOrThrow()).toMatchObject({
      intervalDays: 1,
      correctRecalls: 0,
      lapses: 1,
      lastSeenAt: day(5),
      dueAt: day(6),
    });
  });

  it('passes only items seen before the Conversation to the model, and does not call it when there are none', async () => {
    const inputs = spy();
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE],
      turns: TURNS,
    });
    await service.processPending(ada.user.id, day(1));
    expect(inputs).toHaveLength(0);

    await prisma.learnerItem.createMany({
      data: [
        learnerItemData(ada.user.id, {
          key: 'agenda',
          english: 'agenda',
          lastSeenAt: day(1),
        }),
        learnerItemData(ada.user.id, {
          key: 'minutes',
          english: 'minutes',
          lastSeenAt: day(2),
        }),
      ],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [WORD, CORRECTION],
      turns: TURNS,
    });
    await service.processPending(ada.user.id, day(2));

    const phrase = await itemOf(PHRASE_KEY);
    expect(inputs).toEqual([
      {
        transcript: TURNS,
        notes: [
          {
            index: 0,
            kind: 'word',
            english: WORD.english,
            meaning: WORD.meaning,
          },
          {
            index: 1,
            kind: 'correction',
            english: CORRECTION.english,
            meaning: CORRECTION.meaning,
          },
        ],
        items: [
          { id: phrase.id, english: PHRASE.english, meaning: PHRASE.meaning },
        ],
      },
    ]);
  });

  it('passes at most 60 tracked items, newest first', async () => {
    const inputs = spy();
    await prisma.learnerItem.createMany({
      data: Array.from({ length: 61 }, (_, index) =>
        learnerItemData(ada.user.id, {
          key: `item ${String(index)}`,
          english: `item ${String(index)}`,
          lastSeenAt: new Date(day(0).getTime() + index * 1000),
        }),
      ),
    });
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(1),
      notes: [],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(2));

    expect(inputs).toHaveLength(1);
    const english = inputs.flatMap(({ items }) =>
      items.map((item) => item.english),
    );
    expect(english).toHaveLength(60);
    expect(english[0]).toBe('item 60');
    expect(english[59]).toBe('item 1');
  });

  it('applies a note match from the model to the existing item instead of creating a new one', async () => {
    await taughtPhrase();
    model.script = ({ items }) => ({
      matches: [{ noteIndex: 0, itemId: items[0]?.id ?? '' }],
      outcomes: [],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(3),
      notes: [{ ...PHRASE, english: 'Could we move the meeting?' }],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(4));

    expect(await prisma.learnerItem.count()).toBe(1);
    expect(await itemOf(PHRASE_KEY)).toMatchObject({
      english: PHRASE.english,
      intervalDays: 1,
      dueAt: day(1),
      lastSeenAt: day(3),
    });
  });

  it('ignores judgments for ids it did not ask about, duplicates, and items re-taught in the same Conversation', async () => {
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE, WORD],
    });
    await service.processPending(ada.user.id, day(1));
    const untracked = await prisma.learnerItem.create({
      data: learnerItemData(ada.user.id, {
        key: 'agenda',
        english: 'agenda',
        lastSeenAt: day(2),
      }),
    });
    const phrase = await itemOf(PHRASE_KEY);
    const word = await itemOf('deadline');
    model.script = () => ({
      matches: [],
      outcomes: [
        { itemId: 'not-an-item', outcome: 'recalled' },
        { itemId: untracked.id, outcome: 'missed' },
        { itemId: phrase.id, outcome: 'recalled' },
        { itemId: word.id, outcome: 'missed' },
        { itemId: word.id, outcome: 'recalled' },
      ],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(2),
      notes: [PHRASE],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(3));

    expect(await prisma.learnerItem.count()).toBe(3);
    expect(await itemOf(PHRASE_KEY)).toMatchObject({
      intervalDays: 1,
      dueAt: day(1),
      correctRecalls: 0,
      lastSeenAt: day(2),
    });
    expect(await itemOf('deadline')).toMatchObject({
      intervalDays: 1,
      dueAt: day(3),
      correctRecalls: 0,
      lapses: 1,
      lastSeenAt: day(2),
    });
    expect(await itemOf('agenda')).toEqual(untracked);
  });

  it('ignores a note index out of range', async () => {
    await taughtPhrase();
    model.script = ({ items }) => ({
      matches: [
        { noteIndex: 1, itemId: items[0]?.id ?? '' },
        { noteIndex: -1, itemId: items[0]?.id ?? '' },
        { noteIndex: 0, itemId: 'not-an-item' },
      ],
      outcomes: [],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(3),
      notes: [WORD],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(4));

    expect(await prisma.learnerItem.count()).toBe(2);
    expect(await itemOf(PHRASE_KEY)).toMatchObject({ lastSeenAt: day(0) });
    expect(await itemOf('deadline')).toMatchObject({
      firstSeenAt: day(3),
      intervalDays: 1,
    });
  });

  it('when the model fails three times, keeps the ledger, changes no interval and marks the Conversation processed', async () => {
    await taughtPhrase();
    const script = vi.fn().mockRejectedValue(new Error('model down'));
    model.script = script;
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [WORD],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(2));

    expect(script).toHaveBeenCalledTimes(3);
    expect(await prisma.learnerItem.count()).toBe(2); // the ledger of r2 was kept
    expect(await itemOf(PHRASE_KEY)).toMatchObject({
      intervalDays: 1,
      lastSeenAt: day(0),
    });
    expect(await processedAt('r2')).not.toBeNull();
  });

  it('processes a Conversation without notes using its turns', async () => {
    await taughtPhrase();
    model.script = ({ items }) => ({
      matches: [],
      outcomes: [{ itemId: items[0]?.id ?? '', outcome: 'recalled' }],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(2));

    expect(await prisma.learnerItem.count()).toBe(1);
    expect(await itemOf(PHRASE_KEY)).toMatchObject({ intervalDays: 2 });
    expect(await processedAt('r2')).toEqual(day(2));
  });

  it("processes the User's Conversations oldest first", async () => {
    model.script = ({ items }) => ({
      matches: [],
      outcomes: [{ itemId: items[0]?.id ?? '', outcome: 'recalled' }],
    });
    // Recorded first, but took place after r1.
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [],
      turns: TURNS,
    });
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE],
    });

    await service.processPending(ada.user.id, day(2));

    expect(await itemOf(PHRASE_KEY)).toMatchObject({
      intervalDays: 2,
      correctRecalls: 1,
    });
    expect(await processedAt('r1')).not.toBeNull();
    expect(await processedAt('r2')).not.toBeNull();
  });

  it("keeps each User's items apart", async () => {
    const grace = await registerUser(app, 'grace@example.test');
    const graces = await prisma.learnerItem.create({
      data: learnerItemData(grace.user.id),
    });
    const inputs = spy();
    await taughtPhrase();
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [WORD],
      turns: TURNS,
    });

    await service.processPending(ada.user.id, day(2));

    const phrase = await itemOf(PHRASE_KEY);
    expect(inputs.map(({ items }) => items.map(({ id }) => id))).toEqual([
      [phrase.id],
    ]);
    expect(await itemOf('deadline')).toMatchObject({ firstSeenAt: day(1) });
    expect(
      await prisma.learnerItem.findUniqueOrThrow({ where: { id: graces.id } }),
    ).toEqual(graces);
  });

  it('finishes the run in progress before the app stops', async () => {
    await taughtPhrase();
    model.script = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return NOTHING;
    };
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [WORD],
      turns: TURNS,
    });
    let finished = false;
    const run = service.processPending(ada.user.id, day(2)).then(() => {
      finished = true;
    });

    await stopTestApp(app);
    expect(finished).toBe(true);
    await run;

    app = await startTestApp();
    prisma = app.get(PrismaService);
    expect(await processedAt('r2')).toEqual(day(2));
  });

  it('leaves the Conversation unprocessed when the database step fails, and a later run processes it', async () => {
    await endedConversation(app, ada.user, {
      room: 'r1',
      at: day(0),
      notes: [PHRASE],
    });
    await endedConversation(app, ada.user, {
      room: 'r2',
      at: day(1),
      notes: [WORD],
    });
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('db'));

    await expect(
      service.processPending(ada.user.id, day(2)),
    ).resolves.toBeUndefined();
    expect(await prisma.learnerItem.count()).toBe(0);
    expect(await processedAt('r1')).toBeNull();
    expect(await processedAt('r2')).toBeNull();

    await service.processPending(ada.user.id, day(3));
    expect(await prisma.learnerItem.count()).toBe(2);
    expect(await processedAt('r1')).toEqual(day(3));
    expect(await processedAt('r2')).toEqual(day(3));
  });
});
