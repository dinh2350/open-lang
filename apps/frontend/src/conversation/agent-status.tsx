import { Text } from '@astryxdesign/core/Text';
import {
  type AgentState,
  BarVisualizer,
  type TrackReference,
} from '@livekit/components-react';
import './voice-bars.css';

const AGENT_STATE_TEXT: Partial<Record<AgentState, string>> = {
  listening: 'The Agent is listening.',
  thinking: 'The Agent is thinking.',
  speaking: 'The Agent is speaking.',
};

interface AgentStatusProps {
  readonly agentState: AgentState;
  /** The Agent's audio track, once the Agent publishes one. */
  readonly agentVoice: TrackReference | undefined;
}

/**
 * A visualizer that moves with the Agent's voice, and whether the Agent is
 * listening, thinking or speaking, so the User knows when to talk.
 */
export function AgentStatus({ agentState, agentVoice }: AgentStatusProps) {
  return (
    <>
      <BarVisualizer
        role="img"
        aria-label="The Agent's voice"
        state={agentState}
        track={agentVoice}
        barCount={7}
        className="voice-bars"
      />
      <div role="status">
        <Text as="p" color="secondary">
          {AGENT_STATE_TEXT[agentState] ?? 'Waiting for the Agent…'}
        </Text>
      </div>
    </>
  );
}
