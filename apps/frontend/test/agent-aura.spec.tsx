import type { AgentState } from '@livekit/components-react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentAura } from '@/aura/agent-aura';
import { AURA_FRAGMENT_SHADER } from '@/aura/aura-shader';
import { ThemeModeProvider, useThemeMode } from '@/theme/theme-mode-provider';
import { deviceUses } from './device-mode';
import { canvasesGet, fakeWebGl, stubAnimationFrames } from './fake-webgl';

// These tests use the real `useAuraAnimation`, `motion` and `useTrackVolume`:
// with no audio track, `useTrackVolume` answers 0 and needs nothing mocked.

function ModeButtons() {
  const { setMode } = useThemeMode();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode('light');
        }}
      >
        light
      </button>
      <button
        type="button"
        onClick={() => {
          setMode('dark');
        }}
      >
        dark
      </button>
    </>
  );
}

function aura(state: AgentState) {
  return (
    <ThemeModeProvider>
      <ModeButtons />
      <AgentAura state={state} audioTrack={undefined} />
    </ThemeModeProvider>
  );
}

function setup() {
  const fake = fakeWebGl();
  canvasesGet(fake.gl);
  const frames = stubAnimationFrames();
  return { ...fake, frames };
}

/** A device in light mode that asks for reduced motion. */
function devicePrefersReducedMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgentAura', () => {
  it('is an image named Giọng nói của Gia sư', () => {
    setup();
    deviceUses('light');

    render(aura('listening'));

    expect(
      screen.getByRole('img', { name: 'Giọng nói của Gia sư' }),
    ).toBeInTheDocument();
  });

  it('draws the Aura shader in the brand blue', () => {
    const { frames, fns, lastFrame } = setup();
    deviceUses('light');

    render(aura('listening'));
    frames.step();

    expect(fns.drawArrays).toHaveBeenCalled();
    expect(lastFrame()).toMatchObject({
      uColor: [1 / 255, 118 / 255, 253 / 255],
      uBlur: 0.2,
      uColorShift: 0.05,
      uShape: 1,
      uBloom: 0,
      uSpacing: 0.5,
      uVariance: 0.1,
      uSmoothing: 1,
    });
    const sources = fns.shaderSource.mock.calls.map(([, source]) => source);
    expect(
      sources.some((source) => source.includes(AURA_FRAGMENT_SHADER)),
    ).toBe(true);
  });

  it('moves as fast as the state of the Agent', () => {
    const { frames, lastFloat, fns } = setup();
    deviceUses('light');
    const { rerender } = render(aura('listening'));
    frames.step();
    expect(lastFloat('uSpeed')).toBe(20);

    rerender(aura('speaking'));
    frames.step();

    expect(lastFloat('uSpeed')).toBe(70);
    expect(lastFloat('uScale')).toBeGreaterThan(0);
    expect(lastFloat('uMix')).toBeGreaterThan(0);
    expect(fns.createProgram).toHaveBeenCalledTimes(1);
  });

  it('shows the still blue circle when WebGL is not available', () => {
    deviceUses('light');

    const { container } = render(aura('listening'));

    expect(container.querySelector('.aura-fallback')).toBeInTheDocument();
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Giọng nói của Gia sư' }),
    ).toBeInTheDocument();
  });

  it('follows the light or dark mode without rebuilding the program', () => {
    const { frames, fns, lastFloat } = setup();
    deviceUses('dark');
    render(aura('listening'));
    frames.step();
    expect(lastFloat('uMode')).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    frames.step();
    expect(lastFloat('uMode')).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    frames.step();
    expect(lastFloat('uMode')).toBe(0);

    expect(fns.createProgram).toHaveBeenCalledTimes(1);
  });

  it('draws a single frame when the Member prefers reduced motion', () => {
    const { frames, fns } = setup();
    devicePrefersReducedMotion();

    render(aura('listening'));
    frames.step(5);

    expect(fns.drawArrays).toHaveBeenCalledTimes(1);
  });
});
