/**
 * Tests for `useAuraAnimation`.
 *
 * Derived from `packages/shadcn/tests/use-agent-audio-visualizer-aura.test.ts`
 * of https://github.com/livekit/components-js, commit
 * 370cbca23dab6ea5e65c474e4060e4895f435f33, licensed under the Apache License,
 * Version 2.0 (see `apps/frontend/src/aura/LICENSE-LiveKit-Apache-2.0.txt`).
 *
 * MODIFIED: tests the renamed hook `useAuraAnimation`, which takes a
 * `TrackReference` and has no `volume` override prop, so the tests of that prop
 * are gone. The mock of `motion/react` follows the original; the volume comes
 * from a mocked `createAudioAnalyser` of `livekit-client`, as the hook reads it
 * itself instead of through `useTrackVolume`. The fake motion values stay the
 * same object between renders (as real ones do) and carry the value they
 * started from, so a test can tell which value an `animate` call was for. The
 * assertions are rewritten to check the targets passed to `animate`, state by
 * state, and the values the hook reads back; and there are tests for a still
 * Aura, which runs no animation and reads no volume.
 */
import { act, renderHook } from '@testing-library/react';
import type { AgentState, TrackReference } from '@livekit/components-react';
import { createAudioAnalyser } from 'livekit-client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import { useAuraAnimation } from '@/aura/use-aura-animation';

interface FakeMotionValue {
  /** The value it was created with, which tells the five values apart. */
  readonly initial: number;
  readonly get: () => number;
  readonly isAnimating: () => boolean;
}

type Transition = Readonly<Record<string, unknown>>;

const fakes = vi.hoisted(() => ({
  /** What `isAnimating()` answers for every fake motion value. */
  isAnimating: false,
  /** What `animate` returned, to see whether the hook stopped it. */
  controls: [] as { stop: Mock<() => void> }[],
  animate:
    vi.fn<
      (
        value: FakeMotionValue,
        target: number | number[],
        transition: Transition,
      ) => { stop: () => void }
    >(),
  /** The volume the fake analyser hears. */
  volume: 0,
  cleanup: vi.fn<() => Promise<void>>(),
}));

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('livekit-client')>()),
  createAudioAnalyser: vi.fn(() => ({
    calculateVolume: () => fakes.volume,
    cleanup: fakes.cleanup,
  })),
}));

vi.mock('motion/react', async () => {
  const { useState } = await import('react');
  function useMotionValue(initial: number): FakeMotionValue {
    const [motionValue] = useState<FakeMotionValue>(() => ({
      initial,
      // The fakes never move, so a value reads back as it started.
      get: () => initial,
      isAnimating: () => fakes.isAnimating,
    }));
    return motionValue;
  }
  return { useMotionValue, animate: fakes.animate };
});

/** What each value starts from, which is how a fake motion value is named. */
const START = {
  scale: 0.2,
  amplitude: 2,
  frequency: 0.5,
  brightness: 1.5,
} as const;

type ValueName = keyof typeof START;

/** The `[target, transition]` of every `animate` call for one value, in order. */
function animationsOf(name: ValueName) {
  return fakes.animate.mock.calls
    .filter(([value]) => value.initial === START[name])
    .map(([, target, transition]) => [target, transition] as const);
}

function targetsOf(name: ValueName) {
  return animationsOf(name).map(([target]) => target);
}

/** The targets `animate` is called with for each value, in order. */
type Targets = Record<ValueName, (number | number[])[]>;

const IDLE: Targets = {
  scale: [0.2],
  amplitude: [1.2],
  frequency: [0.4],
  brightness: [1.0],
};
const LISTENING: Targets = {
  scale: [0.3],
  amplitude: [1.0],
  frequency: [0.7],
  brightness: [[1.5, 2.0]],
};
const THINKING: Targets = {
  scale: [0.3],
  amplitude: [0.5],
  frequency: [1],
  brightness: [[0.5, 2.5]],
};
const SPEAKING: Targets = {
  scale: [0.3],
  amplitude: [0.75],
  frequency: [1.25],
  brightness: [1.5],
};

/** The tutor's voice: a reference to a published audio track. */
const TRACK = {
  publication: { track: { kind: 'audio', mediaStream: {} } },
} as unknown as TrackReference;

/** How often the hook reads the volume, as `useTrackVolume` did. */
const VOLUME_INTERVAL_MS = 1000 / 30;

describe('useAuraAnimation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.isAnimating = false;
    fakes.controls.length = 0;
    fakes.volume = 0;
    fakes.cleanup.mockResolvedValue(undefined);
    fakes.animate.mockImplementation(() => {
      const controls = { stop: vi.fn<() => void>() };
      fakes.controls.push(controls);
      return controls;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from the default values', () => {
    const { result } = renderHook(() => useAuraAnimation(undefined));

    expect(result.current()).toEqual({
      speed: 10,
      scale: 0.2,
      amplitude: 2,
      frequency: 0.5,
      brightness: 1.5,
    });
    expect(fakes.animate).not.toHaveBeenCalled();
  });

  it('maps each state to its speed', () => {
    const states: AgentState[] = [
      'idle',
      'failed',
      'disconnected',
      'listening',
      'pre-connect-buffering',
      'thinking',
      'connecting',
      'initializing',
      'speaking',
    ];

    const speeds = Object.fromEntries(
      states.map((state) => [
        state,
        renderHook(() => useAuraAnimation(state)).result.current().speed,
      ]),
    );

    expect(speeds).toEqual({
      idle: 10,
      failed: 10,
      disconnected: 10,
      listening: 20,
      'pre-connect-buffering': 20,
      thinking: 30,
      connecting: 30,
      initializing: 30,
      speaking: 70,
    });
  });

  it('follows a change of state', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useAuraAnimation(state),
      { initialProps: { state: 'listening' as AgentState } },
    );
    expect(result.current().speed).toBe(20);

    rerender({ state: 'speaking' });

    expect(result.current().speed).toBe(70);
  });

  it.each<[AgentState, Targets]>([
    ['idle', IDLE],
    ['failed', IDLE],
    ['disconnected', IDLE],
    ['listening', LISTENING],
    ['pre-connect-buffering', LISTENING],
    ['thinking', THINKING],
    ['connecting', THINKING],
    ['initializing', THINKING],
    ['speaking', SPEAKING],
  ])('eases every value toward its target while %s', (state, targets) => {
    renderHook(() => useAuraAnimation(state));

    expect({
      scale: targetsOf('scale'),
      amplitude: targetsOf('amplitude'),
      frequency: targetsOf('frequency'),
      brightness: targetsOf('brightness'),
    }).toEqual(targets);
  });

  it('springs the scale and pulses the brightness while listening', () => {
    renderHook(() => useAuraAnimation('listening'));

    expect(animationsOf('scale')[0]?.[1]).toEqual(
      expect.objectContaining({ type: 'spring' }),
    );
    expect(animationsOf('brightness')[0]?.[1]).toEqual(
      expect.objectContaining({ repeat: Infinity, repeatType: 'mirror' }),
    );
  });

  it('pulses the brightness while thinking, and holds it while speaking', () => {
    renderHook(() => useAuraAnimation('thinking'));
    expect(animationsOf('brightness')[0]?.[1]).toEqual(
      expect.objectContaining({ repeat: Infinity, repeatType: 'mirror' }),
    );

    fakes.animate.mockClear();
    renderHook(() => useAuraAnimation('speaking'));
    expect(animationsOf('brightness')[0]?.[1]).not.toHaveProperty('repeat');
  });

  it('grows the scale with the track volume while speaking', () => {
    vi.useFakeTimers();
    fakes.volume = 0.5;

    renderHook(() => useAuraAnimation('speaking', TRACK));
    act(() => {
      vi.advanceTimersByTime(VOLUME_INTERVAL_MS);
    });

    expect(animationsOf('scale')).toEqual([
      [0.3, expect.anything()],
      [0.2 + 0.2 * 0.5, { duration: 0 }],
    ]);
  });

  it('ignores the volume when the tutor is not speaking', () => {
    vi.useFakeTimers();
    fakes.volume = 0.8;

    renderHook(() => useAuraAnimation('listening', TRACK));
    act(() => {
      vi.advanceTimersByTime(VOLUME_INTERVAL_MS * 3);
    });

    expect(fakes.animate).not.toHaveBeenCalledWith(
      expect.anything(),
      0.2 + 0.2 * 0.8,
      { duration: 0 },
    );
    expect(targetsOf('scale')).toEqual([0.3]);
  });

  it('waits for the scale to settle before it follows the volume', () => {
    vi.useFakeTimers();
    fakes.volume = 0.5;
    fakes.isAnimating = true;

    renderHook(() => useAuraAnimation('speaking', TRACK));
    act(() => {
      vi.advanceTimersByTime(VOLUME_INTERVAL_MS * 3);
    });

    expect(targetsOf('scale')).toEqual([0.3]);
  });

  it('reads the volume of the track it is given, and lets it go on unmount', () => {
    const { unmount } = renderHook(() => useAuraAnimation('speaking', TRACK));

    expect(createAudioAnalyser).toHaveBeenCalledExactlyOnceWith(
      TRACK.publication.track,
      { fftSize: 512, smoothingTimeConstant: 0.55 },
    );
    expect(fakes.cleanup).not.toHaveBeenCalled();

    unmount();

    expect(fakes.cleanup).toHaveBeenCalledOnce();
  });

  it('stops its animations when it unmounts', () => {
    const { unmount } = renderHook(() => useAuraAnimation('listening'));
    const stops = fakes.controls.map(({ stop }) => stop);
    expect(stops).toHaveLength(4);
    for (const stop of stops) {
      expect(stop).not.toHaveBeenCalled();
    }

    unmount();

    for (const stop of stops) {
      expect(stop).toHaveBeenCalledOnce();
    }
  });

  it('runs no animation and reads no volume while the Aura is still', () => {
    vi.useFakeTimers();
    fakes.volume = 0.5;

    const { result } = renderHook(() =>
      useAuraAnimation('listening', TRACK, false),
    );
    act(() => {
      vi.advanceTimersByTime(VOLUME_INTERVAL_MS * 3);
    });

    expect(fakes.animate).not.toHaveBeenCalled();
    expect(createAudioAnalyser).not.toHaveBeenCalled();
    expect(result.current().speed).toBe(20);
  });

  it('stops its animations when the Aura becomes still', () => {
    const { rerender } = renderHook(
      ({ isMoving }) => useAuraAnimation('listening', TRACK, isMoving),
      { initialProps: { isMoving: true } },
    );
    const stops = fakes.controls.map(({ stop }) => stop);
    expect(stops).toHaveLength(4);

    rerender({ isMoving: false });

    for (const stop of stops) {
      expect(stop).toHaveBeenCalledOnce();
    }
    expect(fakes.cleanup).toHaveBeenCalledOnce();
  });
});
