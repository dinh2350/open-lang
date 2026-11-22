import { type llm, voice } from '@livekit/agents';

/** What the Agent says first in an AgentSession. */
export function firstAgentMessage(
  session: voice.AgentSession,
): Promise<llm.ChatMessage> {
  return new Promise((resolve) => {
    session.on(
      voice.AgentSessionEventTypes.ConversationItemAdded,
      ({ item }) => {
        if (item.type === 'message' && item.role === 'assistant') {
          resolve(item);
        }
      },
    );
  });
}

/**
 * Assertions, such as `judge()`, on a message the Agent said outside
 * `session.run()`, for example its greeting.
 */
export function assertAgentMessage(
  message: llm.ChatMessage,
): voice.testing.MessageAssert {
  const run = new voice.testing.RunResult();
  return new voice.testing.MessageAssert(
    { type: 'message', item: message },
    run.expect,
    0,
  );
}
