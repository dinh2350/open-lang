import { RoomContext, type AgentState } from '@livekit/components-react';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentStatus } from '@/conversation/agent-status';
import { getStatusMessage } from './status-message';
import { createUnconnectedRoom } from './unconnected-room';

/** AgentStatus in a room the Member joined with the microphone on. */
async function renderAgentStatus(agentState: AgentState) {
  const liveKit = createUnconnectedRoom();
  liveKit.joins();
  await liveKit.room.localParticipant.setMicrophoneEnabled(true);
  const view = (state: AgentState) => (
    <RoomContext value={liveKit.room}>
      <AgentStatus agentState={state} agentVoice={undefined} />
    </RoomContext>
  );
  const { rerender } = render(view(agentState));
  return {
    liveKit,
    /** The Agent reports `state`. */
    agentIs: (state: AgentState) => {
      rerender(view(state));
    },
  };
}

describe('AgentStatus', () => {
  it('says the tutor listens while the mic is on', async () => {
    await renderAgentStatus('listening');

    expect(getStatusMessage()).toHaveTextContent('Gia sư đang nghe bạn nói.');
  });

  it('says the tutor waits for the mic while it is off, and listens again once it is on', async () => {
    const { liveKit } = await renderAgentStatus('listening');

    await act(async () =>
      liveKit.room.localParticipant.setMicrophoneEnabled(false),
    );
    expect(getStatusMessage()).toHaveTextContent(
      'Gia sư đang chờ bạn bật mic.',
    );

    await act(async () =>
      liveKit.room.localParticipant.setMicrophoneEnabled(true),
    );
    expect(getStatusMessage()).toHaveTextContent('Gia sư đang nghe bạn nói.');
  });

  it('keeps the thinking and speaking lines while the mic is off', async () => {
    const { liveKit, agentIs } = await renderAgentStatus('listening');
    await act(async () =>
      liveKit.room.localParticipant.setMicrophoneEnabled(false),
    );

    agentIs('thinking');
    expect(getStatusMessage()).toHaveTextContent('Gia sư đang suy nghĩ.');

    agentIs('speaking');
    expect(getStatusMessage()).toHaveTextContent('Gia sư đang nói…');
  });
});
