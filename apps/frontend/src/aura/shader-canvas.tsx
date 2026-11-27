import { type ReactElement, useEffect, useRef } from 'react';
import {
  buildFragmentSource,
  createGlProgram,
  type GlProgram,
  type Uniforms,
} from './webgl-program';

/** A canvas never draws at more than twice the CSS pixels: the eye cannot tell. */
const MAX_PIXEL_RATIO = 2;

interface ShaderCanvasProps {
  /** A Shadertoy-style `mainImage`; it is compiled once, on mount. */
  readonly fragmentShader: string;
  /**
   * The uniforms of the next frame. Their names are fixed on mount; only the
   * values may change. `iTime` and `iResolution` are set by the canvas.
   */
  readonly uniforms: Uniforms;
  /** Draws one frame, and again only when given new uniforms, instead of animating. */
  readonly isStill: boolean;
  /** Called once when the browser has no WebGL or the shader does not build. */
  readonly onUnavailable: () => void;
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
 * once, on mount, and draws the latest `uniforms` each animation frame; it
 * pauses while the page is hidden or the canvas is off-screen. On unmount it
 * stops, frees the program and releases the WebGL context.
 *
 * The context keeps WebGL's default attributes (`alpha` and
 * `premultipliedAlpha` true), which the Aura shader's output relies on.
 */
export function ShaderCanvas({
  fragmentShader,
  uniforms,
  isStill,
  onUnavailable,
  className,
}: ShaderCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Drawing | null>(null);
  const uniformsRef = useRef(uniforms);
  const onUnavailableRef = useRef(onUnavailable);
  const reportedRef = useRef(false);
  /**
   * The release of the context after a cleanup. It waits a microtask, so that
   * React's StrictMode, which cleans up and runs an effect again at once, gets
   * the same live context back instead of a lost one.
   */
  const pendingReleaseRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    uniformsRef.current = uniforms;
    onUnavailableRef.current = onUnavailable;
  }, [uniforms, onUnavailable]);

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
      buildFragmentSource(fragmentShader, uniformsRef.current),
    );
    if (!program) {
      loseContext(gl);
      reportUnavailable();
      return;
    }
    drawingRef.current = { canvas, program };

    return () => {
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
      drawFrame(drawing, uniformsRef.current, timeMs);
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
      if (drawing) drawFrame(drawing, uniforms, timeMs);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isStill, uniforms]);

  return <canvas ref={canvasRef} className={className} />;
}
