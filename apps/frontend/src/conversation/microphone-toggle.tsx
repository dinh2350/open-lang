import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * Mutes and unmutes the User's microphone during a Conversation, so the
 * Agent doesn't hear side noise. Pressed means muted.
 */
export function MicrophoneToggle() {
  const { enabled, pending, toggle } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  return (
    <ToggleButton
      label="Mute microphone"
      isPressed={!enabled}
      isDisabled={pending}
      onPressedChange={() => void toggle()}
    />
  );
}
