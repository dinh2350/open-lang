/*! @license Apache-2.0
 * useAuraAnimation, from useAgentAudioVisualizerAura of LiveKit components-js
 * (https://github.com/livekit/components-js, commit 370cbca2), modified.
 * Copyright 2023 LiveKit, Inc. Licensed under the Apache License, Version 2.0:
 * https://www.apache.org/licenses/LICENSE-2.0
 */
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
 * there is no state (the original kept the last speed). The moving values do
 * not go through React state: the hook returns a function that reads them, so
 * the canvas reads them each frame and nothing renders per frame. For the same
 * reason the volume is read with `createAudioAnalyser` on the same interval and
 * settings as `useTrackVolume`, instead of with that hook. And with `isMoving`
 * false (a still Aura) no animation runs and no volume is read. The values and
 * targets for each state are the original's.
 */
import type { AgentState, TrackReference } from '@livekit/components-react';
import { createAudioAnalyser, isAudioTrack } from 'livekit-client';
import {
  type AnimationPlaybackControlsWithThen,
  animate,
  useMotionValue,
  type ValueAnimationTransition,
} from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

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
/** How the volume is heard, and how often, as LiveKit's Aura does. */
const VOLUME_OPTIONS = { fftSize: 512, smoothingTimeConstant: 0.55 };
const VOLUME_INTERVAL_MS = 1000 / 30;

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
 * A number that moves toward a target over time, outside React: read it with
 * `motionValue.get()`. `animate` starts a move, which stops when the next one
 * starts or `stop` is called.
 */
function useAnimatedValue(initialValue: number) {
  const motionValue = useMotionValue(initialValue);
  const controlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);

  const animateFn = useCallback(
    (targetValue: number | number[], transition: ValueAnimationTransition) => {
      controlsRef.current = animate(motionValue, targetValue, transition);
    },
    [motionValue],
  );
  const stop = useCallback(() => {
    controlsRef.current?.stop();
  }, []);

  return { motionValue, animate: animateFn, stop };
}

/**
 * Animates the Aura for the Agent's `state` and the volume of `audioTrack`,
 * and returns a function that reads the five numbers as they are now. That
 * function changes only with the state, so a component that uses this hook
 * renders when the state changes, not on every frame of the animation.
 *
 * While `isMoving` is false (the Aura is still, or not drawn), it runs no
 * animation and reads no volume.
 */
export function useAuraAnimation(
  state: AgentState | undefined,
  audioTrack?: TrackReference,
  isMoving = true,
): () => AuraAnimation {
  const speed = speedOf(state);
  const {
    motionValue: scale,
    animate: animateScale,
    stop: stopScale,
  } = useAnimatedValue(DEFAULT_SCALE);
  const {
    motionValue: amplitude,
    animate: animateAmplitude,
    stop: stopAmplitude,
  } = useAnimatedValue(DEFAULT_AMPLITUDE);
  const {
    motionValue: frequency,
    animate: animateFrequency,
    stop: stopFrequency,
  } = useAnimatedValue(DEFAULT_FREQUENCY);
  const {
    motionValue: brightness,
    animate: animateBrightness,
    stop: stopBrightness,
  } = useAnimatedValue(DEFAULT_BRIGHTNESS);

  useEffect(() => {
    if (!isMoving) return;
    switch (state) {
      case 'idle':
      case 'failed':
      case 'disconnected':
        animateScale(0.2, DEFAULT_TRANSITION);
        animateAmplitude(1.2, DEFAULT_TRANSITION);
        animateFrequency(0.4, DEFAULT_TRANSITION);
        animateBrightness(1.0, DEFAULT_TRANSITION);
        break;
      case 'listening':
      case 'pre-connect-buffering':
        animateScale(0.3, { type: 'spring', duration: 1.0, bounce: 0.35 });
        animateAmplitude(1.0, DEFAULT_TRANSITION);
        animateFrequency(0.7, DEFAULT_TRANSITION);
        animateBrightness([1.5, 2.0], DEFAULT_PULSE_TRANSITION);
        break;
      case 'thinking':
      case 'connecting':
      case 'initializing':
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(0.5, DEFAULT_TRANSITION);
        animateFrequency(1, DEFAULT_TRANSITION);
        animateBrightness([0.5, 2.5], DEFAULT_PULSE_TRANSITION);
        break;
      case 'speaking':
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(0.75, DEFAULT_TRANSITION);
        animateFrequency(1.25, DEFAULT_TRANSITION);
        animateBrightness(1.5, DEFAULT_TRANSITION);
        break;
    }
    return () => {
      stopScale();
      stopAmplitude();
      stopFrequency();
      stopBrightness();
    };
  }, [
    state,
    isMoving,
    animateScale,
    animateAmplitude,
    animateFrequency,
    animateBrightness,
    stopScale,
    stopAmplitude,
    stopFrequency,
    stopBrightness,
  ]);

  const isSpeakingRef = useRef(state === 'speaking');
  useEffect(() => {
    isSpeakingRef.current = state === 'speaking';
  }, [state]);

  const track = audioTrack?.publication.track;
  useEffect(() => {
    if (!isMoving || !isAudioTrack(track) || !track.mediaStream) return;
    const { calculateVolume, cleanup } = createAudioAnalyser(
      track,
      VOLUME_OPTIONS,
    );
    const interval = setInterval(() => {
      const volume = calculateVolume();
      if (isSpeakingRef.current && volume > 0 && !scale.isAnimating()) {
        animateScale(0.2 + 0.2 * volume, { duration: 0 });
      }
    }, VOLUME_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      void cleanup();
    };
  }, [isMoving, track, scale, animateScale]);

  return useCallback(
    (): AuraAnimation => ({
      speed,
      scale: scale.get(),
      amplitude: amplitude.get(),
      frequency: frequency.get(),
      brightness: brightness.get(),
    }),
    [speed, scale, amplitude, frequency, brightness],
  );
}
