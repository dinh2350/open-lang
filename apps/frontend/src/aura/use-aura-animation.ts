/**
 * The animation of the tutor's Aura: it turns the state of the voice agent
 * into the five numbers the Aura shader needs.
 *
 * Derived from `useAgentAudioVisualizerAura` in
 * `packages/shadcn/hooks/agents-ui/use-agent-audio-visualizer-aura.ts` of
 * https://github.com/livekit/components-js, commit
 * 370cbca23dab6ea5e65c474e4060e4895f435f33, licensed under the Apache License,
 * Version 2.0 (see `LICENSE-LiveKit-Apache-2.0.txt` in this folder).
 *
 * MODIFIED: renamed to `useAuraAnimation`; takes a `TrackReference`, not the
 * wider `LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder`;
 * the `volume` override prop is gone, so the scale always follows the volume of
 * the track; the animated values are numbers only, so the generic and the
 * casts it needed are gone; the animations are stopped when the hook unmounts
 * (the original left the repeating brightness pulse running); `speed` is
 * worked out from the state while rendering, not set in an effect, so it
 * changes with the state in the same render, and it is the default 10 while
 * there is no state (the original kept the last speed); and the unused
 * dependencies of the volume effect are dropped. The values and targets for
 * each state are the original's.
 */
import {
  type AgentState,
  type TrackReference,
  useTrackVolume,
} from '@livekit/components-react';
import {
  type AnimationPlaybackControlsWithThen,
  animate,
  useMotionValue,
  useMotionValueEvent,
  type ValueAnimationTransition,
} from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** The five numbers the Aura shader is drawn with. */
export interface AuraAnimation {
  speed: number;
  scale: number;
  amplitude: number;
  frequency: number;
  brightness: number;
}

const DEFAULT_SPEED = 10;
const DEFAULT_AMPLITUDE = 2;
const DEFAULT_FREQUENCY = 0.5;
const DEFAULT_SCALE = 0.2;
const DEFAULT_BRIGHTNESS = 1.5;
const DEFAULT_TRANSITION: ValueAnimationTransition = {
  duration: 0.5,
  ease: 'easeOut',
};
const DEFAULT_PULSE_TRANSITION: ValueAnimationTransition = {
  duration: 0.35,
  ease: 'easeOut',
  repeat: Infinity,
  repeatType: 'mirror',
};

/**
 * How fast the Aura moves in each state. With no state yet it moves as slowly
 * as when idle.
 */
function speedOf(state: AgentState | undefined): number {
  switch (state) {
    case undefined:
    case 'idle':
    case 'failed':
    case 'disconnected':
      return DEFAULT_SPEED;
    case 'listening':
    case 'pre-connect-buffering':
      return 20;
    case 'thinking':
    case 'connecting':
    case 'initializing':
      return 30;
    case 'speaking':
      return 70;
  }
}

/**
 * A number that moves toward a target over time. `animate` starts a move; a
 * move that is still running stops when the next one starts, or when the
 * component unmounts.
 */
function useAnimatedValue(initialValue: number) {
  const [value, setValue] = useState(initialValue);
  const motionValue = useMotionValue(initialValue);
  const controlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  useMotionValueEvent(motionValue, 'change', setValue);

  useEffect(
    () => () => {
      controlsRef.current?.stop();
    },
    [],
  );

  const animateFn = useCallback(
    (targetValue: number | number[], transition: ValueAnimationTransition) => {
      controlsRef.current = animate(motionValue, targetValue, transition);
    },
    [motionValue],
  );

  return { value, motionValue, animate: animateFn };
}

export function useAuraAnimation(
  state: AgentState | undefined,
  audioTrack?: TrackReference,
): AuraAnimation {
  const speed = speedOf(state);
  const {
    value: scale,
    animate: animateScale,
    motionValue: scaleMotionValue,
  } = useAnimatedValue(DEFAULT_SCALE);
  const { value: amplitude, animate: animateAmplitude } =
    useAnimatedValue(DEFAULT_AMPLITUDE);
  const { value: frequency, animate: animateFrequency } =
    useAnimatedValue(DEFAULT_FREQUENCY);
  const { value: brightness, animate: animateBrightness } =
    useAnimatedValue(DEFAULT_BRIGHTNESS);

  const volume = useTrackVolume(audioTrack, {
    fftSize: 512,
    smoothingTimeConstant: 0.55,
  });

  useEffect(() => {
    switch (state) {
      case 'idle':
      case 'failed':
      case 'disconnected':
        animateScale(0.2, DEFAULT_TRANSITION);
        animateAmplitude(1.2, DEFAULT_TRANSITION);
        animateFrequency(0.4, DEFAULT_TRANSITION);
        animateBrightness(1.0, DEFAULT_TRANSITION);
        return;
      case 'listening':
      case 'pre-connect-buffering':
        animateScale(0.3, { type: 'spring', duration: 1.0, bounce: 0.35 });
        animateAmplitude(1.0, DEFAULT_TRANSITION);
        animateFrequency(0.7, DEFAULT_TRANSITION);
        animateBrightness([1.5, 2.0], DEFAULT_PULSE_TRANSITION);
        return;
      case 'thinking':
      case 'connecting':
      case 'initializing':
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(0.5, DEFAULT_TRANSITION);
        animateFrequency(1, DEFAULT_TRANSITION);
        animateBrightness([0.5, 2.5], DEFAULT_PULSE_TRANSITION);
        return;
      case 'speaking':
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(0.75, DEFAULT_TRANSITION);
        animateFrequency(1.25, DEFAULT_TRANSITION);
        animateBrightness(1.5, DEFAULT_TRANSITION);
        return;
    }
  }, [
    state,
    animateScale,
    animateAmplitude,
    animateFrequency,
    animateBrightness,
  ]);

  useEffect(() => {
    if (state === 'speaking' && volume > 0 && !scaleMotionValue.isAnimating()) {
      animateScale(0.2 + 0.2 * volume, { duration: 0 });
    }
  }, [state, volume, scaleMotionValue, animateScale]);

  return { speed, scale, amplitude, frequency, brightness };
}
