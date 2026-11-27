import type { AgentState, TrackReference } from '@livekit/components-react';
import {
  type ReactElement,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useThemeMode } from '@/theme/theme-mode-provider';
import { AURA_FRAGMENT_SHADER } from './aura-shader';
import { ShaderCanvas } from './shader-canvas';
import { useAuraAnimation } from './use-aura-animation';
import type { Uniforms } from './webgl-program';
import './agent-aura.css';

/** The brand blue, `#0176fd`, as the shader's 0-1 RGB. */
const BRAND_BLUE = [1 / 255, 118 / 255, 253 / 255] as const;

/** The uniforms that stay the same whatever the Agent does. */
const LOOK = {
  uColor: BRAND_BLUE,
  uColorShift: 0.05,
  uBlur: 0.2,
  uShape: 1,
  uBloom: 0,
  uSpacing: 0.5,
  uVariance: 0.1,
  uSmoothing: 1,
} as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof globalThis.matchMedia !== 'function') return () => undefined;
  const query = globalThis.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

/**
 * The tutor's voice, drawn as LiveKit's Aura in the brand blue. It moves with
 * the state of the Agent and the volume of `audioTrack`. When the Member asks
 * for reduced motion it is drawn still, as it looked on mount; without WebGL
 * it is a still blue circle.
 */
export function AgentAura({
  state,
  audioTrack,
}: {
  readonly state: AgentState;
  readonly audioTrack: TrackReference | undefined;
}): ReactElement {
  const { mode } = useThemeMode();
  const animation = useAuraAnimation(state, audioTrack);
  const [stillAnimation] = useState(animation);
  const isStill = useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
  );
  const [isUnavailable, setIsUnavailable] = useState(false);
  const markUnavailable = useCallback(() => {
    setIsUnavailable(true);
  }, []);

  const { speed, scale, amplitude, frequency, brightness } = isStill
    ? stillAnimation
    : animation;
  const uniforms = useMemo<Uniforms>(
    () => ({
      ...LOOK,
      uMode: mode === 'light' ? 1 : 0,
      uSpeed: speed,
      uScale: scale,
      uAmplitude: amplitude,
      uFrequency: frequency,
      uMix: brightness,
    }),
    [mode, speed, scale, amplitude, frequency, brightness],
  );

  return (
    <div className="agent-aura" role="img" aria-label="Giọng nói của Gia sư">
      {isUnavailable ? (
        <div className="aura-fallback" />
      ) : (
        <ShaderCanvas
          className="agent-aura-canvas"
          fragmentShader={AURA_FRAGMENT_SHADER}
          uniforms={uniforms}
          isStill={isStill}
          onUnavailable={markUnavailable}
        />
      )}
    </div>
  );
}
