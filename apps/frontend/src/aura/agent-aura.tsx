import type { AgentState, TrackReference } from '@livekit/components-react';
import {
  type ReactElement,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ThemeMode } from '@/theme/theme-mode';
import { useThemeMode } from '@/theme/theme-mode-provider';
import { AURA_FRAGMENT_SHADER } from './aura-shader';
import { ShaderCanvas } from './shader-canvas';
import { type AuraAnimation, useAuraAnimation } from './use-aura-animation';
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

/** The shader's uniforms for one frame of `animation`, in the light or dark `mode`. */
function uniformsOf(animation: AuraAnimation, mode: ThemeMode): Uniforms {
  return {
    ...LOOK,
    uMode: mode === 'light' ? 1 : 0,
    uSpeed: animation.speed,
    uScale: animation.scale,
    uAmplitude: animation.amplitude,
    uFrequency: animation.frequency,
    uMix: animation.brightness,
  };
}

/**
 * The tutor's voice, drawn as LiveKit's Aura in the brand blue. It moves with
 * the state of the Agent and the volume of `audioTrack`. When the Member asks
 * for reduced motion, or the browser draws WebGL in software (where a moving
 * Aura would load the whole machine), it is drawn still, as it looked on
 * mount; without WebGL it is a still blue circle.
 *
 * The moving values are read by the canvas each frame, so this renders when
 * the state, the mode or the motion setting changes, not on every frame.
 */
export function AgentAura({
  state,
  audioTrack,
}: {
  readonly state: AgentState;
  readonly audioTrack: TrackReference | undefined;
}): ReactElement {
  const { mode } = useThemeMode();
  const prefersStill = useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
  );
  const [isSoftware, setIsSoftware] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const isStill = prefersStill || isSoftware;
  const readAnimation = useAuraAnimation(
    state,
    audioTrack,
    !isStill && !isUnavailable,
  );
  // What a still Aura shows: the values as they were on mount.
  const [stillAnimation] = useState(() => readAnimation());

  const markUnavailable = useCallback(() => {
    setIsUnavailable(true);
  }, []);
  const markSoftware = useCallback(() => {
    setIsSoftware(true);
  }, []);

  const readMovingUniforms = useCallback(
    () => uniformsOf(readAnimation(), mode),
    [readAnimation, mode],
  );
  const stillUniforms = useMemo(
    () => uniformsOf(stillAnimation, mode),
    [stillAnimation, mode],
  );
  const readStillUniforms = useCallback(() => stillUniforms, [stillUniforms]);

  return (
    <div className="agent-aura" role="img" aria-label="Giọng nói của Gia sư">
      {isUnavailable ? (
        <div className="aura-fallback" />
      ) : (
        <ShaderCanvas
          className="agent-aura-canvas"
          fragmentShader={AURA_FRAGMENT_SHADER}
          readUniforms={isStill ? readStillUniforms : readMovingUniforms}
          isStill={isStill}
          onUnavailable={markUnavailable}
          onSoftwareRenderer={markSoftware}
        />
      )}
    </div>
  );
}
