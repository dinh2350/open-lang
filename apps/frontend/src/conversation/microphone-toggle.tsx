import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';

/**
 * Mutes and unmutes the User's microphone during a Conversation, so the
 * Agent doesn't hear side noise. Pressed means muted.
 */
export function MicrophoneToggle() {
  const { enabled, pending, toggle } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  const muted = !enabled;
  return (
    <Button
      variant={muted ? 'secondary' : 'outline'}
      aria-pressed={muted}
      disabled={pending}
      onClick={() => void toggle()}
    >
      Mute microphone
    </Button>
  );
}
