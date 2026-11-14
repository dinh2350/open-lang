import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
} from '@livekit/components-react';
import { ConnectionState, type Room } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { roomTokenSource } from './room-token-source';

interface ConversationPageProps {
  /** The LiveKit Room each Conversation connects through, one at a time. */
  readonly room: Room;
}

/** Start begins a Conversation in a new private room; End leaves it. */
export function ConversationPage({ room }: ConversationPageProps) {
  const session = useSession(roomTokenSource, { room });
  const inConversation =
    session.connectionState !== ConnectionState.Disconnected;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Talk to the Agent</h1>
      <SessionProvider session={session}>
        {inConversation ? (
          <>
            <AgentPresence />
            <Button variant="outline" onClick={() => void session.end()}>
              End
            </Button>
          </>
        ) : (
          <Button onClick={() => void session.start()}>Start</Button>
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
