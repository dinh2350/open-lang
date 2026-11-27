import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * A hand-made WebGL context for the canvas tests: every method is a `vi.fn()`
 * and every uniform location is an object named after its uniform, so a test
 * can read back what was drawn. It compiles and links unless a test says
 * otherwise, and `WEBGL_lose_context` marks it lost.
 *
 * With a `renderer`, it has `WEBGL_debug_renderer_info` and names that
 * renderer as `UNMASKED_RENDERER_WEBGL`; without one, as some browsers do, it
 * does not have the extension.
 */
export function fakeWebGl({ renderer }: { renderer?: string } = {}) {
  let lost = false;
  const loseContext = vi.fn(() => {
    lost = true;
  });
  const extensions: Record<string, object> = {
    WEBGL_lose_context: { loseContext },
  };
  if (renderer !== undefined) {
    extensions.WEBGL_debug_renderer_info = { UNMASKED_RENDERER_WEBGL: 0x9246 };
  }
  const fns = {
    createShader: vi.fn((type: number) => ({ type })),
    shaderSource: vi.fn<(shader: object, source: string) => void>(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => 'shader log'),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({ kind: 'program' })),
    attachShader: vi.fn(),
    bindAttribLocation: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => 'program log'),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => ({ kind: 'buffer' })),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn((_program: object, name: string) => ({ name })),
    uniform1f: vi.fn<(location: { name: string }, value: number) => void>(),
    uniform2f: vi.fn(),
    uniform3f:
      vi.fn<
        (location: { name: string }, r: number, g: number, b: number) => void
      >(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
    isContextLost: vi.fn(() => lost),
    getExtension: vi.fn((name: string) => extensions[name] ?? null),
    getParameter: vi.fn((parameter: number) =>
      parameter === 0x9246 && renderer !== undefined ? renderer : null,
    ),
  };
  const constants = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLE_STRIP: 0x0005,
  };
  const gl = { ...fns, ...constants } as unknown as WebGLRenderingContext;

  /** The value the last frame drew a float uniform with. */
  const lastFloat = (name: string): number | undefined =>
    fns.uniform1f.mock.calls.findLast(
      ([location]) => location.name === name,
    )?.[1];
  /** The value the last frame drew a vec3 uniform with. */
  const lastVec3 = (name: string): readonly number[] | undefined => {
    const call = fns.uniform3f.mock.calls.findLast(
      ([location]) => location.name === name,
    );
    return call && [call[1], call[2], call[3]];
  };
  /** Every uniform, as the last frame drew it. */
  const lastFrame = (): Record<string, number | readonly number[]> => {
    const frame: Record<string, number | readonly number[]> = {};
    for (const [location, value] of fns.uniform1f.mock.calls) {
      frame[location.name] = value;
    }
    for (const [location, ...rgb] of fns.uniform3f.mock.calls) {
      frame[location.name] = rgb;
    }
    return frame;
  };

  return { gl, fns, loseContext, lastFloat, lastVec3, lastFrame };
}

/** Makes every canvas answer `getContext('webgl')` with `gl`. */
export function canvasesGet(gl: WebGLRenderingContext | null) {
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(((contextId: string) =>
      contextId === 'webgl' ? gl : null) as HTMLCanvasElement['getContext']);
}

/**
 * Replaces `requestAnimationFrame` with a queue the test runs by hand: `step`
 * runs the frames asked for so far (each asks for the next one itself).
 */
export function stubAnimationFrames() {
  let nextId = 1;
  let time = 0;
  const queue = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  return {
    /** How many frames are asked for and not yet run. */
    get pending(): number {
      return queue.size;
    },
    /** Runs the frames asked for so far, `times` times over. */
    step(times = 1): void {
      for (let i = 0; i < times; i++) {
        time += 16;
        const callbacks = [...queue.values()];
        queue.clear();
        act(() => {
          for (const callback of callbacks) callback(time);
        });
      }
    },
  };
}
