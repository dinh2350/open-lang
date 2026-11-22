import {
  type ConversationChoice,
  conversationChoiceSchema,
} from '@open-lang/shared';

/**
 * Reads the Scenario and speed the Member chose from the job's metadata, which
 * the backend sets as JSON when it dispatches the Agent. Throws an Error
 * naming the problem when the metadata is missing, is not JSON, or is not a
 * valid choice: the Agent must not guess a Scenario.
 */
export function readConversationChoice(metadata: string): ConversationChoice {
  if (metadata.trim() === '') {
    throw new Error('The job has no metadata, so it names no Scenario');
  }
  let json: unknown;
  try {
    json = JSON.parse(metadata);
  } catch {
    throw new Error('The job metadata is not JSON');
  }
  const choice = conversationChoiceSchema.safeParse(json);
  if (!choice.success) {
    const problems = choice.error.issues
      .map(({ path, message }) => `${path.join('.') || 'metadata'}: ${message}`)
      .join('; ');
    throw new Error(`The job metadata is not a valid choice (${problems})`);
  }
  return choice.data;
}
