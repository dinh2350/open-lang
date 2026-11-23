import { Text } from '@astryxdesign/core/Text';
import {
  type AgentState,
  BarVisualizer,
  type TrackReference,
} from '@livekit/components-react';
import './voice-bars.css';

/** What the status line says about the persona in each state it reports. */
function statusLine(personaName: string, agentState: AgentState): string {
  switch (agentState) {
    case 'listening':
      return `${personaName} đang nghe bạn nói.`;
    case 'thinking':
      return `${personaName} đang suy nghĩ.`;
    case 'speaking':
      return `${personaName} đang nói…`;
    default:
      return `Đang chờ ${personaName}…`;
  }
}

interface AgentStatusProps {
  /** First name of the person the Agent plays in this Scenario. */
  readonly personaName: string;
  readonly agentState: AgentState;
  /** The Agent's audio track, once the Agent publishes one. */
  readonly agentVoice: TrackReference | undefined;
}

/**
 * A visualizer that moves with the Agent's voice, and whether the persona is
 * listening, thinking or speaking, so the Member knows when to talk.
 */
export function AgentStatus({
  personaName,
  agentState,
  agentVoice,
}: AgentStatusProps) {
  return (
    <>
      <BarVisualizer
        role="img"
        aria-label={`Giọng nói của ${personaName}`}
        state={agentState}
        track={agentVoice}
        barCount={7}
        className="voice-bars"
      />
      <div role="status">
        <Text as="p" color="secondary">
          {statusLine(personaName, agentState)}
        </Text>
      </div>
    </>
  );
}
