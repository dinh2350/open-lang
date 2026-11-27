/** A uniform is one float, or three floats (a vec3, such as a color). */
export type UniformValue = number | readonly [number, number, number];
export type Uniforms = Readonly<Record<string, UniformValue>>;

export interface GlProgram {
  draw(
    timeSeconds: number,
    width: number,
    height: number,
    uniforms: Uniforms,
  ): void;
  dispose(): void;
}

const VERTEX_SOURCE = `attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/** A full-screen quad as a triangle strip, in clip space. */
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const QUAD_VERTEX_COUNT = 4;
const POSITION_LOCATION = 0;

function declaration(name: string, value: UniformValue): string {
  return `uniform ${typeof value === 'number' ? 'float' : 'vec3'} ${name};`;
}

/**
 * Wraps a Shadertoy-style `mainImage(out vec4, in vec2)` into a complete
 * fragment shader: it declares `iTime`, `iResolution` and one uniform for
 * each of `uniforms`, and a `main()` that calls `mainImage`.
 */
export function buildFragmentSource(
  shaderToySource: string,
  uniforms: Uniforms,
): string {
  const declarations = [
    'uniform float iTime;',
    'uniform vec2 iResolution;',
    ...Object.entries(uniforms).map(([name, value]) =>
      declaration(name, value),
    ),
  ];
  return [
    'precision highp float;',
    ...declarations,
    shaderToySource,
    `void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`,
  ].join('\n');
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('The shader did not compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function linkProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, POSITION_LOCATION, 'aPosition');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('The program did not link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function buildProgram(
  gl: WebGLRenderingContext,
  fragmentSource: string,
): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  if (!vertexShader) return null;
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = fragmentShader
    ? linkProgram(gl, vertexShader, fragmentShader)
    : null;
  // A linked program keeps what it needs; the shader objects can go.
  gl.deleteShader(vertexShader);
  if (fragmentShader) gl.deleteShader(fragmentShader);
  return program;
}

/** `UNMASKED_RENDERER_WEBGL` of the `WEBGL_debug_renderer_info` extension. */
const UNMASKED_RENDERER_WEBGL = 0x9246;

/**
 * The names a renderer that draws on the CPU goes by: Chrome's SwiftShader,
 * Mesa's llvmpipe and softpipe, Windows' WARP ("Basic Render Driver"), and any
 * that calls itself software.
 */
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Whether `gl` draws on the CPU instead of a GPU, as on a virtual machine, over
 * remote desktop, or with hardware acceleration off. A browser that does not
 * say which renderer it uses counts as having a GPU.
 */
export function isSoftwareRenderer(gl: WebGLRenderingContext): boolean {
  if (!gl.getExtension('WEBGL_debug_renderer_info')) return false;
  const renderer: unknown = gl.getParameter(UNMASKED_RENDERER_WEBGL);
  return typeof renderer === 'string' && SOFTWARE_RENDERER.test(renderer);
}

/**
 * Compiles and links `fragmentSource` with a vertex shader for a full-screen
 * quad. Returns `null` when that fails: the reason goes to `console.error`
 * and nothing is left allocated.
 */
export function createGlProgram(
  gl: WebGLRenderingContext,
  fragmentSource: string,
): GlProgram | null {
  const program = buildProgram(gl, fragmentSource);
  if (!program) return null;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

  const locations = new Map<string, WebGLUniformLocation | null>();
  const locationOf = (name: string): WebGLUniformLocation | null => {
    let location = locations.get(name);
    if (location === undefined) {
      location = gl.getUniformLocation(program, name);
      locations.set(name, location);
    }
    return location;
  };

  return {
    draw(timeSeconds, width, height, uniforms) {
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(POSITION_LOCATION);
      gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(locationOf('iTime'), timeSeconds);
      gl.uniform2f(locationOf('iResolution'), width, height);
      for (const [name, value] of Object.entries(uniforms)) {
        if (typeof value === 'number') {
          gl.uniform1f(locationOf(name), value);
        } else {
          gl.uniform3f(locationOf(name), value[0], value[1], value[2]);
        }
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD_VERTEX_COUNT);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    },
  };
}
