import {
  RoomAudioRenderer,
  SessionProvider,
  useSession,
} from '@livekit/components-react';
import { ConnectionState, type Room } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { AgentStatus } from './agent-status';
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
            <AgentStatus />
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
