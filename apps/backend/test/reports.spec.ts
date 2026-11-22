import type { AuthResponse } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeReportModel } from '../src/reports/fake-report-model.js';
import {
  REPORT_MODEL,
  ReportModelError,
  type ReportDraft,
  type ReportInput,
  type ReportModel,
} from '../src/reports/report-model.js';
import {
  at,
  ingestMiss,
  ingestTurn,
  readConversation,
  requestReport,
  startConversation,
} from './support/conversations.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

const ROOM = 'room-under-test';

/** The Fake model, recording what it was asked. */
class SpyModel implements ReportModel {
  readonly inputs: ReportInput[] = [];
  private readonly fake = new FakeReportModel();

  draft(input: ReportInput): Promise<ReportDraft> {
    this.inputs.push(input);
    return this.fake.draft(input);
  }
}

describe('Report generation', () => {
  let app: INestApplication<App>;
  let ada: AuthResponse;

  /** Starts the app, with `model` in place of the configured ReportModel, and Ada's Conversation. */
  async function start(model?: ReportModel): Promise<void> {
    app = await startTestApp({}, (builder) =>
      model === undefined
        ? builder
        : builder.overrideProvider(REPORT_MODEL).useValue(model),
    );
    ada = await registerUser(app, 'ada@example.test');
    await startConversation(app, ada.user, ROOM);
  }

  afterEach(async () => {
    await stopTestApp(app);
  });

  /** Waits until the Report is no longer being written. */
  function settled() {
    return vi.waitFor(async () => {
      const detail = await readConversation(app, ada.authToken, ROOM);
      expect(detail.reportStatus).not.toBe('generating');
      return detail;
    });
  }

  /** Asks for the Report and waits until it is no longer being written. */
  async function reportOf() {
    await requestReport(app, ada.authToken, ROOM).expect(202);
    return settled();
  }

  const agentTurn = (itemId: string, text: string, from: number, to: number) =>
    ingestTurn(app, ROOM, {
      itemId,
      role: 'agent',
      text,
      startedAt: at(from),
      endedAt: at(to),
    });

  it('a Report lists each missed Agent sentence with its explanation', async () => {
    await start();
    await agentTurn('a1', 'Any blockers today?', 0, 4.5);
    await ingestMiss(app, ROOM, at(2));

    const detail = await reportOf();

    expect(detail.reportStatus).toBe('ready');
    expect(detail.report?.listeningMisses).toEqual([
      {
        agentText: 'Any blockers today?',
        keyPhrases: [],
        explanation: 'Giải thích thử nghiệm.',
      },
    ]);
  });

  it("a Report lists grammar issues from the User's turns", async () => {
    await start();
    await agentTurn('a1', 'Any blockers today?', 0, 4);
    await ingestTurn(app, ROOM, {
      itemId: 'u1',
      role: 'user',
      text: 'I am no blocker.',
      startedAt: at(5),
      endedAt: at(8),
    });

    const detail = await reportOf();

    expect(detail.report?.grammarIssues.map((issue) => issue.said)).toEqual([
      'I am no blocker.',
    ]);
    expect(detail.report?.fluency.longestTurnSeconds).toBe(3);
  });

  it('orders turns by start time even when they arrived late', async () => {
    const model = new SpyModel();
    await start(model);
    await agentTurn('a2', 'Great, thanks.', 9, 12);
    await ingestTurn(app, ROOM, {
      itemId: 'u1',
      role: 'user',
      text: 'Fine.',
      startedAt: at(5),
      endedAt: at(8),
    });
    await agentTurn('a1', 'Any blockers today?', 0, 4);
    await ingestMiss(app, ROOM, at(2));

    const detail = await reportOf();

    expect(model.inputs).toHaveLength(1);
    expect(model.inputs[0]?.transcript.map((turn) => turn.text)).toEqual([
      'Any blockers today?',
      'Fine.',
      'Great, thanks.',
    ]);
    expect(model.inputs[0]?.missedTurnIndexes).toEqual([0]);
    expect(
      detail.report?.listeningMisses.map((miss) => miss.agentText),
    ).toEqual(['Any blockers today?']);
  });

  it('a Conversation never ended still produces a Report from its stored turns', async () => {
    await start();
    await ingestTurn(app, ROOM, {
      itemId: 'a1',
      role: 'agent',
      text: 'Any blockers today?',
      startedAt: at(0),
    });
    await ingestTurn(app, ROOM, {
      itemId: 'u1',
      role: 'user',
      text: 'No blockers.',
      startedAt: at(4),
    });
    await ingestMiss(app, ROOM, at(1));

    const detail = await reportOf();

    expect(detail.reportStatus).toBe('ready');
    expect(detail.report?.listeningMisses).toHaveLength(1);
    expect(detail.report?.grammarIssues).toHaveLength(1);
  });

  it('an empty Conversation gets an empty ready Report and the model is never called', async () => {
    const model = new SpyModel();
    await start(model);

    const detail = await reportOf();

    expect(detail.reportStatus).toBe('ready');
    expect(detail.report).toEqual({
      listeningMisses: [],
      grammarIssues: [],
      fluency: {
        wordsPerMinute: null,
        talkRatio: null,
        fillerWordsEstimate: 0,
        longestTurnSeconds: null,
      },
    });
    expect(model.inputs).toHaveLength(0);
  });

  it('a press with no earlier Agent turn is left out', async () => {
    await start();
    await agentTurn('a1', 'Any blockers today?', 10, 14);
    await ingestMiss(app, ROOM, at(1));

    const detail = await reportOf();

    expect(detail.reportStatus).toBe('ready');
    expect(detail.report?.listeningMisses).toEqual([]);
  });

  it('a model error marks the Report failed, keeps the turns, and asking again makes it ready', async () => {
    const fake = new FakeReportModel();
    let calls = 0;
    await start({
      draft: (input) => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new Error('The model is down.'))
          : fake.draft(input);
      },
    });
    await agentTurn('a1', 'Any blockers today?', 0, 4);

    const failed = await reportOf();

    expect(failed.reportStatus).toBe('failed');
    expect(failed.report).toBeNull();
    expect(await app.get(PrismaService).turn.count()).toBe(1);

    const again = await reportOf();

    expect(again.reportStatus).toBe('ready');
    expect(calls).toBe(2);
  });

  it('invalid model output marks the Report failed', async () => {
    await start({
      draft: () => Promise.reject(new ReportModelError('Not JSON.')),
    });
    await agentTurn('a1', 'Any blockers today?', 0, 4);

    const detail = await reportOf();

    expect(detail.reportStatus).toBe('failed');
    expect(detail.report).toBeNull();
  });

  it('a Report that is generating and younger than two minutes is not started again', async () => {
    const fake = new FakeReportModel();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const draft = vi.fn(async (input: ReportInput) => {
      await gate;
      return fake.draft(input);
    });
    await start({ draft });
    await agentTurn('a1', 'Any blockers today?', 0, 4);

    const first = await requestReport(app, ada.authToken, ROOM);
    const second = await requestReport(app, ada.authToken, ROOM);

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(second.body).toEqual({ status: 'generating' });
    await vi.waitFor(() => {
      expect(draft).toHaveBeenCalledTimes(1);
    });
    release();
    const detail = await settled();
    expect(detail.reportStatus).toBe('ready');
    expect(draft).toHaveBeenCalledTimes(1);
  });

  it('a Report that has been generating for over two minutes is started again', async () => {
    const model = new SpyModel();
    await start(model);
    await agentTurn('a1', 'Any blockers today?', 0, 4);
    const prisma = app.get(PrismaService);
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { roomName: ROOM },
    });
    await prisma.report.create({
      data: {
        conversationId: conversation.id,
        status: 'generating',
        startedAt: new Date(Date.now() - 121_000),
      },
    });

    const detail = await reportOf();

    expect(detail.reportStatus).toBe('ready');
    expect(model.inputs).toHaveLength(1);
  });

  it('a ready Report is returned as it is, without a second model call', async () => {
    const model = new SpyModel();
    await start(model);
    await agentTurn('a1', 'Any blockers today?', 0, 4);
    await reportOf();

    const again = await requestReport(app, ada.authToken, ROOM);

    expect(again.status).toBe(202);
    expect(again.body).toEqual({ status: 'ready' });
    expect(model.inputs).toHaveLength(1);
  });

  it("POST report for another User's room answers 404", async () => {
    const model = new SpyModel();
    await start(model);
    const grace = await registerUser(app, 'grace@example.test');

    const response = await requestReport(app, grace.authToken, ROOM);

    expect(response.status).toBe(404);
    expect(model.inputs).toHaveLength(0);
    expect(await app.get(PrismaService).report.count()).toBe(0);
  });
});
