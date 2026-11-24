import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useConnectionState, useTrackToggle } from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';
import { MicrophoneOffIcon } from '@/icons';

/**
 * Turns the Member's microphone off and on during the Conversation. While it
 * is off in a joined room, a line under the button says the tutor cannot
 * hear them.
 */
export function MicToggle() {
  const { enabled, pending, toggle } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  const connectionState = useConnectionState();
  const muted = !enabled && connectionState === ConnectionState.Connected;
  return (
    <Stack gap={2} align="center" maxWidth="12rem">
      <Button
        label={enabled ? 'Tắt mic' : 'Bật mic'}
        variant="secondary"
        icon={<Icon icon={enabled ? 'microphone' : MicrophoneOffIcon} />}
        isDisabled={pending}
        onClick={() => void toggle()}
      />
      {/* The region is always there, so a screen reader announces the line. */}
      <div role="status">
        {muted && (
          <Text as="p" type="supporting" justify="center">
            Mic đang tắt. Gia sư không nghe thấy bạn.
          </Text>
        )}
      </div>
    </Stack>
  );
}
