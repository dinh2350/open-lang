import { Text } from '@astryxdesign/core/Text';
import {
  type AgentState,
  BarVisualizer,
  type TrackReference,
} from '@livekit/components-react';
import './voice-bars.css';

/** What the status line says about the tutor in each state it reports. */
function statusLine(agentState: AgentState): string {
  switch (agentState) {
    case 'listening':
      return 'Gia sư đang nghe bạn nói.';
    case 'thinking':
      return 'Gia sư đang suy nghĩ.';
    case 'speaking':
      return 'Gia sư đang nói…';
    default:
      return 'Đang chờ Gia sư…';
  }
}

interface AgentStatusProps {
  readonly agentState: AgentState;
  /** The Agent's audio track, once the Agent publishes one. */
  readonly agentVoice: TrackReference | undefined;
}

/**
 * A visualizer that moves with the Agent's voice, and whether the tutor is
 * listening, thinking or speaking, so the Member knows when to talk.
 */
export function AgentStatus({ agentState, agentVoice }: AgentStatusProps) {
  return (
    <>
      <BarVisualizer
        role="img"
        aria-label="Giọng nói của Gia sư"
        state={agentState}
        track={agentVoice}
        barCount={7}
        className="voice-bars"
      />
      <div role="status">
        <Text as="p" color="secondary">
          {statusLine(agentState)}
        </Text>
      </div>
    </>
  );
}
