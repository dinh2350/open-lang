import { afterEach, describe, expect, it, vi } from 'vitest';
import { AURA_FRAGMENT_SHADER } from '@/aura/aura-shader';
import {
  buildFragmentSource,
  createGlProgram,
  type Uniforms,
} from '@/aura/webgl-program';

const SHADER_TOY_SOURCE = 'void mainImage(out vec4 c, in vec2 p){}';

/**
 * A hand-made WebGL context: every method is a `vi.fn()`, and every uniform
 * location is an object named after its uniform, so a test can tell which
 * uniform a call was for. Shaders and the program compile and link unless a
 * test says otherwise.
 */
function fakeGl() {
  const vertexShader = { kind: 'vertex shader' };
  const fragmentShader = { kind: 'fragment shader' };
  const program = { kind: 'program' };
  const buffer = { kind: 'buffer' };

  const fns = {
    createShader: vi.fn<(type: number) => object | null>((type) =>
      type === constants.VERTEX_SHADER ? vertexShader : fragmentShader,
    ),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn<(shader: object) => boolean>(() => true),
    getShaderInfoLog: vi.fn(() => 'shader log'),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => program),
    attachShader: vi.fn(),
    bindAttribLocation: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => 'program log'),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => buffer),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn((_program: object, name: string) => ({ name })),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
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

  return {
    gl: { ...fns, ...constants } as unknown as WebGLRenderingContext,
    fns,
    constants,
    vertexShader,
    fragmentShader,
    program,
    buffer,
  };
}

/** The `console.error` of the shader compile and link failures, kept quiet. */
function spyOnConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildFragmentSource', () => {
  it('declares a uniform for every value, and the built-ins', () => {
    const source = buildFragmentSource(SHADER_TOY_SOURCE, {
      uSpeed: 1,
      uColor: [0, 0.5, 1],
    });

    expect(source).toContain('uniform float uSpeed;');
    expect(source).toContain('uniform vec3 uColor;');
    expect(source).toContain('uniform float iTime;');
    expect(source).toContain('uniform vec2 iResolution;');
    expect(source).toMatch(/^precision highp float;/);
    expect(source.indexOf('uniform float uSpeed;')).toBeLessThan(
      source.indexOf(SHADER_TOY_SOURCE),
    );
    expect(source.trimEnd()).toMatch(
      /void main\(\)\s*\{[^}]*mainImage\(color, gl_FragCoord\.xy\);\s*gl_FragColor = color;\s*\}$/,
    );
  });
});

describe('createGlProgram', () => {
  it('returns null, and deletes the shader, when the shader does not compile', () => {
    const { gl, fns, vertexShader, fragmentShader } = fakeGl();
    fns.getShaderParameter.mockImplementation(
      (shader: object) => shader !== fragmentShader,
    );
    const consoleError = spyOnConsoleError();

    const program = createGlProgram(
      gl,
      buildFragmentSource(SHADER_TOY_SOURCE, {}),
    );

    expect(program).toBeNull();
    expect(fns.deleteShader).toHaveBeenCalledWith(fragmentShader);
    expect(fns.deleteShader).toHaveBeenCalledWith(vertexShader);
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('did not compile'),
      'shader log',
    );
    expect(fns.linkProgram).not.toHaveBeenCalled();
  });

  it('returns null when the program does not link', () => {
    const { gl, fns, program: linked } = fakeGl();
    fns.getProgramParameter.mockReturnValue(false);
    const consoleError = spyOnConsoleError();

    const program = createGlProgram(
      gl,
      buildFragmentSource(SHADER_TOY_SOURCE, {}),
    );

    expect(program).toBeNull();
    expect(fns.deleteProgram).toHaveBeenCalledWith(linked);
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('did not link'),
      'program log',
    );
  });

  it('returns null when the context cannot create a shader', () => {
    const { gl, fns } = fakeGl();
    fns.createShader.mockReturnValue(null);

    const program = createGlProgram(
      gl,
      buildFragmentSource(SHADER_TOY_SOURCE, {}),
    );

    expect(program).toBeNull();
    expect(fns.shaderSource).not.toHaveBeenCalled();
    expect(fns.createProgram).not.toHaveBeenCalled();
  });
});

describe('a GlProgram', () => {
  const uniforms: Uniforms = { uSpeed: 2, uColor: [0.1, 0.5, 1] };

  function createdProgram() {
    const fake = fakeGl();
    const program = createGlProgram(
      fake.gl,
      buildFragmentSource(SHADER_TOY_SOURCE, uniforms),
    );
    if (!program) throw new Error('the fake gl should compile and link');
    return { ...fake, linked: fake.program, program };
  }

  it('draws the quad with the time, the resolution and every uniform', () => {
    const { program, fns, constants } = createdProgram();

    program.draw(1.5, 640, 480, uniforms);

    expect(fns.viewport).toHaveBeenCalledWith(0, 0, 640, 480);
    expect(fns.uniform1f).toHaveBeenCalledWith({ name: 'iTime' }, 1.5);
    expect(fns.uniform1f).toHaveBeenCalledWith({ name: 'uSpeed' }, 2);
    expect(fns.uniform2f).toHaveBeenCalledWith(
      { name: 'iResolution' },
      640,
      480,
    );
    expect(fns.uniform3f).toHaveBeenCalledWith({ name: 'uColor' }, 0.1, 0.5, 1);
    expect(fns.drawArrays).toHaveBeenCalledExactlyOnceWith(
      constants.TRIANGLE_STRIP,
      0,
      4,
    );
    const lastUniformCall = Math.max(
      ...[fns.uniform1f, fns.uniform2f, fns.uniform3f].flatMap(
        (uniform) => uniform.mock.invocationCallOrder,
      ),
    );
    expect(fns.drawArrays.mock.invocationCallOrder[0]).toBeGreaterThan(
      lastUniformCall,
    );
  });

  it('looks each uniform location up once, however often it draws', () => {
    const { program, fns } = createdProgram();
    expect(fns.getUniformLocation).not.toHaveBeenCalled();

    program.draw(0, 640, 480, uniforms);
    program.draw(0.016, 640, 480, uniforms);
    program.draw(0.032, 640, 480, uniforms);

    const looked = fns.getUniformLocation.mock.calls.map(([, name]) => name);
    expect(looked.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'iResolution',
      'iTime',
      'uColor',
      'uSpeed',
    ]);
  });

  it('dispose deletes the program and the buffer', () => {
    const { program, fns, linked, buffer } = createdProgram();

    program.dispose();

    expect(fns.deleteProgram).toHaveBeenCalledWith(linked);
    expect(fns.deleteBuffer).toHaveBeenCalledWith(buffer);
  });
});

describe('AURA_FRAGMENT_SHADER', () => {
  it('reads the uniforms the Aura hook sets, and no other', () => {
    const code = AURA_FRAGMENT_SHADER.split('\n')
      .map((line) => line.split('//', 1)[0])
      .join('\n');

    const read = new Set(code.match(/\bu[A-Z]\w*/g));

    expect(read).toEqual(
      new Set([
        'uSpeed',
        'uBlur',
        'uScale',
        'uShape',
        'uFrequency',
        'uAmplitude',
        'uBloom',
        'uMix',
        'uSpacing',
        'uColorShift',
        'uVariance',
        'uSmoothing',
        'uMode',
        'uColor',
      ]),
    );
  });
});
