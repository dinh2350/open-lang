import type { AgentState } from '@livekit/components-react';

const AGENT_STATE_TEXT: Partial<Record<AgentState, string>> = {
  listening: 'The Agent is listening.',
  thinking: 'The Agent is thinking.',
  speaking: 'The Agent is speaking.',
};

interface AgentStatusProps {
  readonly agentState: AgentState;
}

/** Whether the Agent is listening, thinking or speaking, so the User knows when to talk. */
export function AgentStatus({ agentState }: AgentStatusProps) {
  return (
    <p role="status" className="text-muted-foreground">
      {AGENT_STATE_TEXT[agentState] ?? 'Waiting for the Agent…'}
    </p>
  );
}
