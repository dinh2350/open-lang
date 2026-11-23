import { Button } from '@astryxdesign/core/Button';
import { useRoomContext } from '@livekit/components-react';
import { LISTENING_HELP_MESSAGE } from '@open-lang/shared';

/** LiveKit's topic for chat text, which the Agent reads the help message on. */
const CHAT_TOPIC = 'lk.chat';

/**
 * "Chưa nghe kịp": tells the Agent, in the Conversation's Room, that the
 * Member did not catch what it said, so the Agent says it again, slower.
 * The Member's own words are not sent.
 */
export function ListeningHelpButton() {
  const room = useRoomContext();
  return (
    <Button
      label="Chưa nghe kịp"
      variant="primary"
      onClick={() => {
        room.localParticipant
          .sendText(LISTENING_HELP_MESSAGE, { topic: CHAT_TOPIC })
          .catch((error: unknown) => {
            console.error('The listening help message was not sent:', error);
          });
      }}
    />
  );
}
