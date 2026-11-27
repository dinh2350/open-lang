import { act, render } from '@testing-library/react';
import { type ComponentProps, StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShaderCanvas } from '@/aura/shader-canvas';
import type { Uniforms } from '@/aura/webgl-program';
import { canvasesGet, fakeWebGl, stubAnimationFrames } from './fake-webgl';

const SHADER = 'void mainImage(out vec4 c, in vec2 p){}';

function setup() {
  const fake = fakeWebGl();
  canvasesGet(fake.gl);
  const frames = stubAnimationFrames();
  return { ...fake, frames };
}

function canvas(
  uniforms: Uniforms,
  props: Partial<ComponentProps<typeof ShaderCanvas>> = {},
) {
  return (
    <ShaderCanvas
      fragmentShader={SHADER}
      readUniforms={() => uniforms}
      isStill={false}
      onUnavailable={() => undefined}
      onSoftwareRenderer={() => undefined}
      {...props}
    />
  );
}

/** Makes `document.hidden` answer `hidden` and tells the page it changed. */
function documentIs(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  // The own property shadows jsdom's; deleting it brings jsdom's back.
  Reflect.deleteProperty(document, 'hidden');
});

describe('ShaderCanvas', () => {
  it('draws the uniforms it was given, each frame', () => {
    const { frames, fns, lastFloat, lastVec3 } = setup();

    render(canvas({ uSpeed: 2, uColor: [0.1, 0.5, 1] }));
    frames.step();

    expect(fns.drawArrays).toHaveBeenCalledTimes(1);
    expect(lastFloat('uSpeed')).toBe(2);
    expect(lastVec3('uColor')).toEqual([0.1, 0.5, 1]);

    frames.step(3);

    expect(fns.drawArrays).toHaveBeenCalledTimes(4);
    const times = fns.uniform1f.mock.calls
      .filter(([location]) => location.name === 'iTime')
      .map(([, time]) => time);
    expect(times).toEqual([0.016, 0.032, 0.048, 0.064]);
  });

  it('builds the program once, however often the uniforms change', () => {
    const { frames, fns, lastFloat } = setup();
    const { rerender } = render(canvas({ uSpeed: 0 }));
    frames.step();

    for (let speed = 1; speed <= 5; speed++) {
      rerender(canvas({ uSpeed: speed }));
      frames.step();
      expect(lastFloat('uSpeed')).toBe(speed);
    }

    expect(fns.createProgram).toHaveBeenCalledTimes(1);
    expect(fns.compileShader).toHaveBeenCalledTimes(2);
    expect(fns.drawArrays).toHaveBeenCalledTimes(6);
  });

  it('stops drawing while the document is hidden, and resumes when it is visible again', () => {
    const { frames, fns } = setup();
    render(canvas({ uSpeed: 1 }));
    frames.step();
    expect(fns.drawArrays).toHaveBeenCalledTimes(1);

    documentIs(true);
    frames.step(3);

    expect(fns.drawArrays).toHaveBeenCalledTimes(1);
    expect(frames.pending).toBe(0);

    documentIs(false);
    frames.step(2);

    expect(fns.drawArrays).toHaveBeenCalledTimes(3);
    expect(frames.pending).toBe(1);
  });

  it('draws a single frame when it is still', () => {
    const { frames, fns } = setup();

    render(canvas({ uSpeed: 1 }, { isStill: true }));
    frames.step(5);

    expect(fns.drawArrays).toHaveBeenCalledTimes(1);
    expect(frames.pending).toBe(0);
  });

  it('draws one more frame when it is still and given new uniforms', () => {
    const { frames, fns, lastFloat } = setup();
    const { rerender } = render(canvas({ uSpeed: 1 }, { isStill: true }));
    frames.step(3);

    rerender(canvas({ uSpeed: 2 }, { isStill: true }));
    frames.step(3);

    expect(fns.drawArrays).toHaveBeenCalledTimes(2);
    expect(lastFloat('uSpeed')).toBe(2);
    expect(frames.pending).toBe(0);
  });

  it('calls onUnavailable, once, when WebGL is not available', () => {
    const frames = stubAnimationFrames();
    const onUnavailable = vi.fn();

    const { rerender } = render(canvas({ uSpeed: 1 }, { onUnavailable }));
    rerender(canvas({ uSpeed: 2 }, { onUnavailable }));
    frames.step(3);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(frames.pending).toBe(0);
  });

  it('calls onUnavailable when the shader does not compile', () => {
    const { frames, fns } = setup();
    fns.getShaderParameter.mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onUnavailable = vi.fn();

    render(canvas({ uSpeed: 1 }, { onUnavailable }));
    frames.step(3);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(fns.drawArrays).not.toHaveBeenCalled();
  });

  it('calls onUnavailable, and stops drawing, when the browser loses the context', () => {
    const { frames, fns } = setup();
    const onUnavailable = vi.fn();
    const { container } = render(canvas({ uSpeed: 1 }, { onUnavailable }));
    frames.step();
    expect(fns.drawArrays).toHaveBeenCalledTimes(1);

    act(() => {
      container
        .querySelector('canvas')
        ?.dispatchEvent(new Event('webglcontextlost'));
    });
    frames.step(3);

    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(fns.drawArrays).toHaveBeenCalledTimes(1);
  });

  it('stops listening for a lost context when it unmounts', () => {
    setup();
    const onUnavailable = vi.fn();
    const { container, unmount } = render(
      canvas({ uSpeed: 1 }, { onUnavailable }),
    );
    const element = container.querySelector('canvas');
    if (!element) throw new Error('ShaderCanvas should render a canvas');

    unmount();
    element.dispatchEvent(new Event('webglcontextlost'));

    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('reads the uniforms afresh for each frame, without being rendered again', () => {
    const { frames, lastFloat } = setup();
    let speed = 1;
    render(canvas({}, { readUniforms: () => ({ uSpeed: speed }) }));
    frames.step();
    expect(lastFloat('uSpeed')).toBe(1);

    speed = 2;
    frames.step();

    expect(lastFloat('uSpeed')).toBe(2);
  });

  it.each([
    'Google SwiftShader',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Microsoft Basic Render Driver',
  ])(
    'calls onSoftwareRenderer, once, when the browser draws with %s',
    (renderer) => {
      const fake = fakeWebGl({ renderer });
      canvasesGet(fake.gl);
      stubAnimationFrames();
      const onSoftwareRenderer = vi.fn();

      const { rerender } = render(
        canvas({ uSpeed: 1 }, { onSoftwareRenderer }),
      );
      rerender(canvas({ uSpeed: 2 }, { onSoftwareRenderer }));

      expect(onSoftwareRenderer).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [
      'a GPU',
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
    ],
    ['a renderer it does not name', undefined],
  ])('does not call onSoftwareRenderer with %s', (_, renderer) => {
    const fake = fakeWebGl({ renderer });
    canvasesGet(fake.gl);
    stubAnimationFrames();
    const onSoftwareRenderer = vi.fn();

    render(canvas({ uSpeed: 1 }, { onSoftwareRenderer }));

    expect(onSoftwareRenderer).not.toHaveBeenCalled();
  });

  it('releases the program and the context when it unmounts, and draws nothing after', async () => {
    const { frames, fns, loseContext } = setup();
    const { unmount } = render(canvas({ uSpeed: 1 }));
    frames.step();
    expect(fns.drawArrays).toHaveBeenCalledTimes(1);

    unmount();
    frames.step(3);

    expect(fns.drawArrays).toHaveBeenCalledTimes(1);
    expect(frames.pending).toBe(0);
    expect(fns.deleteProgram).toHaveBeenCalledTimes(1);
    expect(fns.deleteBuffer).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(loseContext).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps one loop and a live context after a StrictMode double mount', async () => {
    const { frames, fns, loseContext } = setup();

    render(<StrictMode>{canvas({ uSpeed: 1 })}</StrictMode>);
    await Promise.resolve();
    frames.step(3);

    expect(fns.drawArrays).toHaveBeenCalledTimes(3);
    expect(frames.pending).toBe(1);
    expect(loseContext).not.toHaveBeenCalled();
  });

  it('draws at a pixel ratio of at most 2', () => {
    const { frames, fns } = setup();
    vi.stubGlobal('devicePixelRatio', 3);
    const { container } = render(canvas({ uSpeed: 1 }));
    const element = container.querySelector('canvas');
    if (!element) throw new Error('ShaderCanvas should render a canvas');
    Object.defineProperty(element, 'clientWidth', { value: 150 });
    Object.defineProperty(element, 'clientHeight', { value: 100 });

    frames.step();

    expect(element.width).toBe(300);
    expect(element.height).toBe(200);
    expect(fns.viewport).toHaveBeenLastCalledWith(0, 0, 300, 200);
  });
});
