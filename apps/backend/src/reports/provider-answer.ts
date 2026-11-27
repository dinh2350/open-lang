const FENCE = '```';
const FENCE_LANGUAGE = 'json';

/** Removes a surrounding ``` or ```json code fence, if there is one. */
export function unfence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 2 * FENCE.length) return trimmed;
  if (!trimmed.startsWith(FENCE) || !trimmed.endsWith(FENCE)) return trimmed;

  const inner = trimmed.slice(FENCE.length, -FENCE.length).trimStart();
  const unlabelled = inner.toLowerCase().startsWith(FENCE_LANGUAGE)
    ? inner.slice(FENCE_LANGUAGE.length)
    : inner;
  return unlabelled.trim();
}

/** How a model's failures read and what they are called. */
export interface ProviderAnswerErrors {
  /** The Provider's name, as the messages spell it: "OpenAI". */
  readonly provider: string;
  /** What the Provider is asked for, as the messages spell it: "report". */
  readonly subject: string;
  /** The error class of the model that asks. */
  readonly errorClass: new (message: string, options?: ErrorOptions) => Error;
}

/**
 * Asks a Provider for its answer. A failed request, such as a timeout,
 * becomes an error of `errorClass` that keeps the original as its `cause`; an
 * empty answer is one too.
 */
export async function answerFromProvider(
  { provider, subject, errorClass: ModelError }: ProviderAnswerErrors,
  ask: () => Promise<string | undefined>,
): Promise<string> {
  let answer: string | undefined;
  try {
    answer = await ask();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    throw new ModelError(`${provider} ${subject} request failed: ${reason}`, {
      cause: error,
    });
  }
  if (!answer) {
    throw new ModelError(`${provider} returned an empty ${subject}.`);
  }
  return answer;
}
