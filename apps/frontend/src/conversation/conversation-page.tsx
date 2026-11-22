import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
} from '@livekit/components-react';
import { ConnectionState, MediaDeviceFailure, type Room } from 'livekit-client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { AgentStatus } from './agent-status';
import { MicrophoneToggle } from './microphone-toggle';
import { createRoomTokenSource } from './room-token-source';

interface ConversationPageProps {
  /** The LiveKit Room each Conversation connects through, one at a time. */
  readonly room: Room;
  /**
   * How long a Conversation waits for the Agent to join and start listening
   * before it shows "Agent unavailable" and ends.
   */
  readonly agentJoinTimeoutMilliseconds: number;
}

type ConversationFailure =
  'microphone-denied' | 'start-failed' | 'agent-unavailable';

const failureMessages: Record<ConversationFailure, string> = {
  'microphone-denied':
    "The Agent can't hear you because microphone access is blocked. Allow microphone access for this site in your browser's site settings, then press Start.",
  'start-failed': "Couldn't start the Conversation. Press Start to try again.",
  'agent-unavailable':
    'Agent unavailable, so the Conversation has ended. Press Start to try again.',
};

/**
 * Why Start failed: the User denied the microphone, or something else went
 * wrong, which is logged for developers.
 */
function startFailure(error: unknown): ConversationFailure {
  if (
    MediaDeviceFailure.getFailure(error) === MediaDeviceFailure.PermissionDenied
  ) {
    return 'microphone-denied';
  }
  console.error('The Conversation failed to start:', error);
  return 'start-failed';
}

/** Start begins a Conversation in a new private room; End leaves it. */
export function ConversationPage({
  room,
  agentJoinTimeoutMilliseconds,
}: ConversationPageProps) {
  const { authorizedFetch } = useAuth();
  const [roomTokenSource] = useState(() =>
    createRoomTokenSource(authorizedFetch),
  );
  const session = useSession(roomTokenSource, {
    room,
    agentConnectTimeoutMilliseconds: agentJoinTimeoutMilliseconds,
  });
  const agent = useAgent(session);
  const [failure, setFailure] = useState<ConversationFailure | null>(null);
  // The Agent's failed state clears once the room disconnects, so keep it.
  if (agent.state === 'failed' && failure === null) {
    setFailure('agent-unavailable');
  }
  const inConversation =
    failure === null &&
    session.connectionState !== ConnectionState.Disconnected;

  // A Conversation that failed leaves its room, even when the room finished
  // connecting after the failure.
  const { connectionState, end } = session;
  useEffect(() => {
    if (failure !== null && connectionState !== ConnectionState.Disconnected) {
      void end();
    }
  }, [failure, connectionState, end]);

  async function startConversation(): Promise<void> {
    setFailure(null);
    try {
      await session.start();
    } catch (error) {
      setFailure(startFailure(error));
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Talk to the Agent</h1>
      {failure !== null && (
        <p role="alert" className="text-destructive text-center">
          {failureMessages[failure]}
        </p>
      )}
      <SessionProvider session={session}>
        {inConversation ? (
          <>
            <AgentStatus
              agentState={agent.state}
              agentVoice={agent.microphoneTrack}
            />
            <div className="flex gap-3">
              <MicrophoneToggle />
              <Button variant="outline" onClick={() => void session.end()}>
                End
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={() => void startConversation()}>Start</Button>
        )}
        <RoomAudioRenderer />
      </SessionProvider>
    </main>
  );
}
