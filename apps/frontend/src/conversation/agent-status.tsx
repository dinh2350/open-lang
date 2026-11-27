import { Text } from '@astryxdesign/core/Text';
import type { AgentState } from '@livekit/components-react';
import type { ReactElement } from 'react';
import { useMicMuted } from './use-mic-muted';

/**
 * What the status line says about the tutor in each state it reports. The
 * tutor is not listening while the Member's mic is off, so it says it waits.
 */
function statusLine(agentState: AgentState, isMicMuted: boolean): string {
  switch (agentState) {
    case 'listening':
      return isMicMuted
        ? 'Gia sư đang chờ bạn bật mic.'
        : 'Gia sư đang nghe bạn nói.';
    case 'thinking':
      return 'Gia sư đang suy nghĩ.';
    case 'speaking':
      return 'Gia sư đang nói…';
    default:
      return 'Đang chờ Gia sư…';
  }
}

/**
 * Whether the tutor is listening, thinking or speaking, so the Member knows
 * when to talk. Call it inside a LiveKit room context.
 */
export function AgentStatusLine({
  agentState,
}: {
  readonly agentState: AgentState;
}): ReactElement {
  const isMicMuted = useMicMuted();
  return (
    <div role="status">
      <Text as="p" color="secondary" justify="center">
        {statusLine(agentState, isMicMuted)}
      </Text>
    </div>
  );
}
