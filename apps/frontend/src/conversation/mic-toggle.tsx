import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useTrackToggle } from '@livekit/components-react';
import { MediaDeviceFailure, Track } from 'livekit-client';
import { useState } from 'react';
import { MicrophoneOffIcon } from '@/icons';
import { useMicMuted } from './use-mic-muted';

/**
 * Why the microphone could not be switched: the browser blocks it for this
 * page, there is no microphone, or something else, which is logged for
 * developers.
 */
function failureMessage(error: unknown): string {
  switch (MediaDeviceFailure.getFailure(error)) {
    case MediaDeviceFailure.PermissionDenied:
      return 'Gia sư không nghe được bạn vì quyền dùng micro đang bị chặn. Hãy cho phép micro cho trang này trong cài đặt trình duyệt, rồi bấm Bật mic.';
    case MediaDeviceFailure.NotFound:
      return 'Không tìm thấy micro. Hãy cắm micro, rồi bấm Bật mic.';
    default:
      console.error('The microphone could not be switched:', error);
      return 'Không bật được mic. Hãy thử lại.';
  }
}

/**
 * Turns the Member's microphone off and on during the Conversation. While it
 * is off in a joined room, a line under the button says the tutor cannot
 * hear them. When the microphone cannot be turned on, an alert says why,
 * until a later press works.
 */
export function MicToggle() {
  const { enabled, pending, toggle } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  const muted = useMicMuted();
  const [failure, setFailure] = useState<string | null>(null);

  // The hook re-throws what the Room throws (its onError takes only Error
  // instances, and a browser's DOMException may not be one), so catch here.
  async function switchMicrophone(): Promise<void> {
    try {
      await toggle();
      setFailure(null);
    } catch (error: unknown) {
      setFailure(failureMessage(error));
    }
  }

  return (
    <Stack gap={2} align="center" maxWidth="12rem">
      <Button
        label={enabled ? 'Tắt mic' : 'Bật mic'}
        variant="secondary"
        icon={<Icon icon={enabled ? 'microphone' : MicrophoneOffIcon} />}
        isDisabled={pending}
        onClick={() => void switchMicrophone()}
      />
      {/* The region is always there, so a screen reader announces the line. */}
      <div role="status">
        {muted && (
          <Text as="p" type="supporting" justify="center">
            Mic đang tắt. Gia sư không nghe thấy bạn.
          </Text>
        )}
      </div>
      {failure !== null && (
        <Banner status="error" role="alert" title={failure} />
      )}
    </Stack>
  );
}
