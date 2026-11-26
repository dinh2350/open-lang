import { Badge } from '@astryxdesign/core/Badge';
import { HStack } from '@astryxdesign/core/HStack';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import {
  type TextStreamData,
  useRoomContext,
  useTranscriptions,
  useVoiceAssistant,
} from '@livekit/components-react';

/** The attribute that groups the updates of one transcribed segment. */
const SEGMENT_ID = 'lk.segment_id';
/** The attribute that says a transcription will not change any more. */
const TRANSCRIPTION_FINAL = 'lk.transcription_final';

interface TranscriptLine {
  readonly key: string;
  readonly isMember: boolean;
  readonly text: string;
  readonly isLive: boolean;
}

/**
 * The Conversation's lines in the order they started. The Member's line is
 * live until its transcription is final. The Agent's streams never say they
 * are final, so its last line is live while it is speaking.
 */
function transcriptLines(
  transcriptions: readonly TextStreamData[],
  memberIdentity: string,
  agentIsSpeaking: boolean,
): TranscriptLine[] {
  const lastAgentIndex = transcriptions.findLastIndex(
    ({ participantInfo }) => participantInfo.identity !== memberIdentity,
  );
  return transcriptions.map(({ text, participantInfo, streamInfo }, index) => {
    const isMember = participantInfo.identity === memberIdentity;
    return {
      key: streamInfo.attributes?.[SEGMENT_ID] ?? streamInfo.id,
      isMember,
      text,
      isLive: isMember
        ? streamInfo.attributes?.[TRANSCRIPTION_FINAL] !== 'true'
        : agentIsSpeaking && index === lastAgentIndex,
    };
  });
}

/**
 * What the tutor and the Member say, as the Agent transcribes it, one line
 * per turn, labelled Gia sư or Bạn; the line being spoken is marked. The
 * text is the Agent's, so it is shown as plain text.
 */
export function TranscriptPanel() {
  const room = useRoomContext();
  const transcriptions = useTranscriptions();
  const { state: agentState } = useVoiceAssistant();
  const lines = transcriptLines(
    transcriptions,
    room.localParticipant.identity,
    agentState === 'speaking',
  );
  if (lines.length === 0) {
    return (
      <Text as="p" color="secondary">
        Chữ của cuộc nói sẽ hiện ở đây.
      </Text>
    );
  }
  return (
    <Stack as="ol" gap={4}>
      {lines.map(({ key, isMember, text, isLive }) => (
        <Stack as="li" key={key} gap={1}>
          <HStack gap={2} align="center">
            <Text type="label" color="secondary">
              {isMember ? 'Bạn' : 'Gia sư'}
            </Text>
            {isLive && <Badge variant="blue" label="Đang nói" />}
          </HStack>
          <Text as="p">{text}</Text>
        </Stack>
      ))}
    </Stack>
  );
}
