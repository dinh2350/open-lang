import { describe, expect, it, vi } from 'vitest';
import { answerFromProvider, unfence } from '../src/reports/provider-answer.js';

class TestModelError extends Error {}

const errors = {
  provider: 'Acme',
  subject: 'thing',
  errorClass: TestModelError,
} as const;

describe('answerFromProvider', () => {
  it('returns the answer as it is', async () => {
    await expect(
      answerFromProvider(errors, () => Promise.resolve('{"a":1}')),
    ).resolves.toBe('{"a":1}');
  });

  it("wraps a failed request in the model's error, naming the Provider and keeping the cause", async () => {
    const failure = new Error('socket hang up');

    const error = await answerFromProvider(errors, () =>
      Promise.reject(failure),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TestModelError);
    expect((error as TestModelError).message).toBe(
      'Acme thing request failed: socket hang up',
    );
    expect((error as TestModelError).cause).toBe(failure);
  });

  it('says "unknown error" when the request failed with something that is not an Error', async () => {
    const ask = vi.fn().mockRejectedValue('quota exceeded');

    const error = await answerFromProvider(errors, ask).catch(
      (caught: unknown) => caught,
    );

    expect((error as TestModelError).message).toBe(
      'Acme thing request failed: unknown error',
    );
    expect((error as TestModelError).cause).toBe('quota exceeded');
  });

  it.each([undefined, ''])('treats an answer of %j as empty', async (empty) => {
    const error = await answerFromProvider(errors, () =>
      Promise.resolve(empty),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TestModelError);
    expect((error as TestModelError).message).toBe(
      'Acme returned an empty thing.',
    );
  });
});

describe('unfence', () => {
  it.each([
    ['{"a":1}', '{"a":1}'],
    ['```json\n{"a":1}\n```', '{"a":1}'],
    ['```JSON\n{"a":1}\n```', '{"a":1}'],
    ['```\n{"a":1}\n```', '{"a":1}'],
    ['  ```json\n{"a":1}\n```  ', '{"a":1}'],
    ['``', '``'],
    ['```json\n{"a":1}', '```json\n{"a":1}'],
  ])('turns %j into %j', (text, expected) => {
    expect(unfence(text)).toBe(expected);
  });
});
