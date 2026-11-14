import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
} from '@livekit/components-react';
import { ConnectionState, MediaDeviceFailure, type Room } from 'livekit-client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { roomTokenSource } from './room-token-source';

interface ConversationPageProps {
  /** The LiveKit Room each Conversation connects through, one at a time. */
  readonly room: Room;
}

type ConversationFailure = 'microphone-denied';

const failureMessages: Record<ConversationFailure, string> = {
  'microphone-denied':
    "The Agent can't hear you because microphone access is blocked. Allow microphone access for this site in your browser's site settings, then press Start.",
};

/** Start begins a Conversation in a new private room; End leaves it. */
export function ConversationPage({ room }: ConversationPageProps) {
  const session = useSession(roomTokenSource, { room });
  const [failure, setFailure] = useState<ConversationFailure | null>(null);
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
      if (
        MediaDeviceFailure.getFailure(error) !==
        MediaDeviceFailure.PermissionDenied
      ) {
        throw error;
      }
      setFailure('microphone-denied');
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
            <AgentPresence />
            <Button variant="outline" onClick={() => void session.end()}>
              End
            </Button>
          </>
        ) : (
          <Button onClick={() => void startConversation()}>Start</Button>
        )}
        <RoomAudioRenderer />
      </SessionProvider>
    </main>
  );
}

function AgentPresence() {
  const agent = useAgent();
  return (
    <p role="status" className="text-muted-foreground">
      {agent.isConnected ? 'The Agent has joined.' : 'Waiting for the Agent…'}
    </p>
  );
}
