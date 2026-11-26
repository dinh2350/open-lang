import { APIConnectionTimeoutError } from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { createReportModel } from '../src/reports/create-report-model.js';
import { FakeReportModel } from '../src/reports/fake-report-model.js';
import {
  GoogleReportModel,
  type GoogleClient,
} from '../src/reports/google-report-model.js';
import {
  OpenAiReportModel,
  type OpenAiClient,
} from '../src/reports/openai-report-model.js';
import {
  ReportModelError,
  type ReportInput,
  type ReportModel,
} from '../src/reports/report-model.js';

const input: ReportInput = {
  transcript: [
    { role: 'agent', text: 'Any blockers?' },
    { role: 'user', text: 'No blocker.' },
  ],
  notes: [
    {
      kind: 'word',
      english: 'blocker',
      meaning: 'Trở ngại.',
      said: null,
    },
  ],
};

const answer = {
  overview: 'Bạn trả lời ngắn gọn.',
  strengths: ['Trả lời đúng ý.'],
  improvements: ['Dùng số nhiều: blockers.'],
};

const draft = { assessment: answer };

function openAiClientAnswering(outputText: string) {
  const create = vi.fn().mockResolvedValue({ output_text: outputText });
  const client: OpenAiClient = { responses: { create } };
  return { client, create };
}

function googleClientAnswering(text: string | undefined) {
  const generateContent = vi.fn().mockResolvedValue({ text });
  const client: GoogleClient = { models: { generateContent } };
  return { client, generateContent };
}

describe('OpenAiReportModel', () => {
  it("returns the draft parsed from the client's JSON", async () => {
    const { client, create } = openAiClientAnswering(JSON.stringify(answer));

    const result = await new OpenAiReportModel(client, 'gpt-test').draft(input);

    expect(result).toEqual(draft);
    const [body, options] = create.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(body).toMatchObject({
      model: 'gpt-test',
      text: { format: { type: 'json_object' } },
    });
    expect(String(body.input)).toContain('User: No blocker.');
    expect(String(body.instructions)).toContain('Vietnamese');
    // No SDK retries: one run must end within the timeout.
    expect(options).toMatchObject({ timeout: 60_000, maxRetries: 0 });
  });

  it('fails instead of hanging when the request times out', async () => {
    const create = vi.fn().mockRejectedValue(new APIConnectionTimeoutError());
    const model = new OpenAiReportModel({ responses: { create } }, 'gpt-test');

    await expect(model.draft(input)).rejects.toBeInstanceOf(ReportModelError);
    await expect(model.draft(input)).rejects.toThrow(/timed out/i);
  });

  it('lets the timeout be set', async () => {
    const { client, create } = openAiClientAnswering(JSON.stringify(answer));

    await new OpenAiReportModel(client, 'gpt-test', 5_000).draft(input);

    expect(create.mock.calls[0]?.[1]).toMatchObject({ timeout: 5_000 });
  });
});

describe('GoogleReportModel', () => {
  it("returns the draft parsed from the client's JSON", async () => {
    const { client, generateContent } = googleClientAnswering(
      JSON.stringify(answer),
    );

    const result = await new GoogleReportModel(client, 'gemini-test').draft(
      input,
    );

    expect(result).toEqual(draft);
    const [request] = generateContent.mock.calls[0] as [
      { model: string; contents: string; config: Record<string, unknown> },
    ];
    expect(request.model).toBe('gemini-test');
    expect(request.contents).toContain('User: No blocker.');
    expect(request.config).toMatchObject({
      responseMimeType: 'application/json',
      // One attempt: no SDK retries, so one run ends within the timeout.
      httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } },
    });
    expect(String(request.config.systemInstruction)).toContain('Vietnamese');
  });

  it('fails instead of hanging when the request is aborted by its timeout', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(
        new DOMException('The operation timed out.', 'TimeoutError'),
      );
    const model = new GoogleReportModel({ models: { generateContent } }, 'g');

    await expect(model.draft(input)).rejects.toBeInstanceOf(ReportModelError);
    await expect(model.draft(input)).rejects.toThrow(/timed out/i);
  });

  it('lets the timeout be set', async () => {
    const { client, generateContent } = googleClientAnswering(
      JSON.stringify(answer),
    );

    await new GoogleReportModel(client, 'g', 5_000).draft(input);

    expect(generateContent.mock.calls[0]?.[0]).toMatchObject({
      config: { httpOptions: { timeout: 5_000 } },
    });
  });
});

describe('both real report models', () => {
  const models: [string, (text: string | undefined) => ReportModel][] = [
    [
      'OpenAiReportModel',
      (text) =>
        new OpenAiReportModel(openAiClientAnswering(text ?? '').client, 'm'),
    ],
    [
      'GoogleReportModel',
      (text) => new GoogleReportModel(googleClientAnswering(text).client, 'm'),
    ],
  ];

  it.each(models)(
    '%s throws ReportModelError when the client returns text that is not a draft',
    async (_name, make) => {
      await expect(make('not json').draft(input)).rejects.toBeInstanceOf(
        ReportModelError,
      );
      await expect(
        make('{"listeningMisses":[],"grammarIssues":[]}').draft(input),
      ).rejects.toBeInstanceOf(ReportModelError);
      await expect(make(undefined).draft(input)).rejects.toBeInstanceOf(
        ReportModelError,
      );
    },
  );

  it.each(models)(
    '%s keeps the transcript out of its errors',
    async (_name, make) => {
      const error = await make('not json')
        .draft(input)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain('No blocker');
    },
  );
});

describe('createReportModel', () => {
  const env = {
    REPORT_PROVIDER: 'fake',
    REPORT_MODEL: undefined,
    OPENAI_API_KEY: undefined,
    GOOGLE_API_KEY: undefined,
  } as const;

  it('returns the fake model for fake and the matching class otherwise', () => {
    expect(createReportModel(env)).toBeInstanceOf(FakeReportModel);
    expect(
      createReportModel({
        ...env,
        REPORT_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
      }),
    ).toBeInstanceOf(OpenAiReportModel);
    expect(
      createReportModel({
        ...env,
        REPORT_PROVIDER: 'google',
        GOOGLE_API_KEY: 'g-test',
      }),
    ).toBeInstanceOf(GoogleReportModel);
  });

  it('throws naming the variable when the key is missing', () => {
    expect(() =>
      createReportModel({ ...env, REPORT_PROVIDER: 'openai' }),
    ).toThrow(/OPENAI_API_KEY/);
    expect(() =>
      createReportModel({ ...env, REPORT_PROVIDER: 'google' }),
    ).toThrow(/GOOGLE_API_KEY/);
  });
});
