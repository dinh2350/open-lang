import { describe, expect, it } from 'vitest';
import conversationAgent from '../src/conversation-agent.ts';
import { dispatchToRoom } from './fake-job.ts';

describe('Agent dispatched into a Conversation room', () => {
  it('joins the room and logs that the Conversation started, with the room name', async () => {
    const job = await dispatchToRoom(conversationAgent, 'conversation-123');
    await job.end();

    expect(job.joinedRoom()).toBe(true);
    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation started',
        roomName: 'conversation-123',
      }),
    );
  });

  it('logs that the Conversation ended, with the room name and the reason, when its job ends', async () => {
    const job = await dispatchToRoom(conversationAgent, 'conversation-456');

    await job.end();

    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation ended',
        roomName: 'conversation-456',
        reason: 'job_shutdown',
      }),
    );
  });
});
