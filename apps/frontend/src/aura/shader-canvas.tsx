import { type ReactElement, useEffect, useRef } from 'react';
import {
  buildFragmentSource,
  createGlProgram,
  type GlProgram,
  isSoftwareRenderer,
  type Uniforms,
} from './webgl-program';

/** A canvas never draws at more than twice the CSS pixels: the eye cannot tell. */
const MAX_PIXEL_RATIO = 2;

interface ShaderCanvasProps {
  /** A Shadertoy-style `mainImage`; it is compiled once, on mount. */
  readonly fragmentShader: string;
  /**
   * Gives the uniforms of the next frame; it is called for every frame, so
   * the values can move without the canvas being rendered again. Their names
   * are fixed on mount; only the values may change. `iTime` and `iResolution`
   * are set by the canvas.
   */
  readonly readUniforms: () => Uniforms;
  /**
   * Draws one frame, and again only when given a new `readUniforms`, instead
   * of animating.
   */
  readonly isStill: boolean;
  /**
   * Called once when the browser has no WebGL, the shader does not build, or
   * the browser takes the WebGL context away.
   */
  readonly onUnavailable: () => void;
  /**
   * Called once when the browser draws WebGL on the CPU, where a moving canvas
   * would load the whole machine; the canvas should then be made still.
   */
  readonly onSoftwareRenderer: () => void;
  readonly className?: string;
}

interface Drawing {
  readonly canvas: HTMLCanvasElement;
  readonly program: GlProgram;
}

/** The device's pixel ratio, or 1 when the browser does not say. */
function devicePixelRatio(): number {
  const ratio: unknown = globalThis.devicePixelRatio;
  return typeof ratio === 'number' && ratio > 0 ? ratio : 1;
}

/**
 * Sizes the canvas to its CSS box at the device's pixel ratio (at most
 * `MAX_PIXEL_RATIO`) and draws one frame at `timeMs`.
 */
function drawFrame(drawing: Drawing, uniforms: Uniforms, timeMs: number) {
  const { canvas, program } = drawing;
  const ratio = Math.min(devicePixelRatio(), MAX_PIXEL_RATIO);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  program.draw(timeMs / 1000, width, height, uniforms);
}

function loseContext(gl: WebGLRenderingContext) {
  gl.getExtension('WEBGL_lose_context')?.loseContext();
}

/**
 * A `<canvas>` that draws `fragmentShader` with WebGL. It builds the program
 * once, on mount, and draws what `readUniforms` gives each animation frame; it
 * pauses while the page is hidden or the canvas is off-screen. On unmount it
 * stops, frees the program and releases the WebGL context.
 *
 * The context keeps WebGL's default attributes (`alpha` and
 * `premultipliedAlpha` true), which the Aura shader's output relies on. When
 * the browser loses the context, the canvas is left blank, so it reports
 * itself unavailable; it does not try to restore it.
 */
export function ShaderCanvas({
  fragmentShader,
  readUniforms,
  isStill,
  onUnavailable,
  onSoftwareRenderer,
  className,
}: ShaderCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Drawing | null>(null);
  const readUniformsRef = useRef(readUniforms);
  const onUnavailableRef = useRef(onUnavailable);
  const onSoftwareRendererRef = useRef(onSoftwareRenderer);
  const reportedRef = useRef(false);
  const softwareReportedRef = useRef(false);
  /**
   * The release of the context after a cleanup. It waits a microtask, so that
   * React's StrictMode, which cleans up and runs an effect again at once, gets
   * the same live context back instead of a lost one.
   */
  const pendingReleaseRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    readUniformsRef.current = readUniforms;
    onUnavailableRef.current = onUnavailable;
    onSoftwareRendererRef.current = onSoftwareRenderer;
  }, [readUniforms, onUnavailable, onSoftwareRenderer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (pendingReleaseRef.current) {
      pendingReleaseRef.current.cancelled = true;
      pendingReleaseRef.current = null;
    }
    const reportUnavailable = () => {
      if (reportedRef.current) return;
      reportedRef.current = true;
      onUnavailableRef.current();
    };

    const gl = canvas.getContext('webgl');
    if (!gl) {
      reportUnavailable();
      return;
    }
    const program = createGlProgram(
      gl,
      buildFragmentSource(fragmentShader, readUniformsRef.current()),
    );
    if (!program) {
      loseContext(gl);
      reportUnavailable();
      return;
    }
    drawingRef.current = { canvas, program };
    if (!softwareReportedRef.current && isSoftwareRenderer(gl)) {
      softwareReportedRef.current = true;
      onSoftwareRendererRef.current();
    }
    const contextLost = () => {
      drawingRef.current = null;
      reportUnavailable();
    };
    canvas.addEventListener('webglcontextlost', contextLost);

    return () => {
      canvas.removeEventListener('webglcontextlost', contextLost);
      drawingRef.current = null;
      program.dispose();
      const release = { cancelled: false };
      pendingReleaseRef.current = release;
      queueMicrotask(() => {
        if (!release.cancelled) loseContext(gl);
      });
    };
  }, [fragmentShader]);

  useEffect(() => {
    if (isStill) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame: number | null = null;
    let offScreen = false;

    const tick = (timeMs: number) => {
      frame = null;
      const drawing = drawingRef.current;
      if (!drawing) return;
      drawFrame(drawing, readUniformsRef.current(), timeMs);
      update();
    };
    /** Asks for the next frame while the canvas can be seen, else stops. */
    const update = () => {
      if (document.hidden || offScreen) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
      } else {
        frame ??= requestAnimationFrame(tick);
      }
    };

    document.addEventListener('visibilitychange', update);
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            offScreen = !(entries.at(-1)?.isIntersecting ?? true);
            update();
          })
        : null;
    observer?.observe(canvas);
    update();

    return () => {
      document.removeEventListener('visibilitychange', update);
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [isStill]);

  useEffect(() => {
    if (!isStill) return;
    const frame = requestAnimationFrame((timeMs) => {
      const drawing = drawingRef.current;
      if (drawing) drawFrame(drawing, readUniforms(), timeMs);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isStill, readUniforms]);

  return <canvas ref={canvasRef} className={className} />;
}
