# Tutor screen redesign, batch 1 (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A calmer lesson screen: logo and favicon, an aura instead of the voice bars, the status line and the controls at the bottom, and Cuộc nói and Ghi chú hidden in a side panel that opens by button; plus the two bug fixes agreed earlier.

**Architecture:** The lesson screen becomes one full-height column: the aura and a side panel in the body, the status line and the controls at the bottom. The side panel sits in the layout (a right column on a wide screen, below the aura on a phone), is never modal, and keeps both its panels mounted while hidden, so the transcript loses no lines. The aura is LiveKit's Aura shader and animation hook, ported, drawn by a small WebGL renderer written here.

**Tech Stack:** React 19, Astryx (StyleX), `@livekit/components-react`, `motion` (new), WebGL, Vitest + Testing Library (jsdom), Playwright.

**Spec:** [docs/superpowers/specs/2026-11-27-tutor-screen-redesign-design.html](../specs/2026-11-27-tutor-screen-redesign-design.html), approved on 2026-11-27. This plan replaces [2026-11-27-tutor-screen-status-and-nav.md](2026-11-27-tutor-screen-status-and-nav.md): Tasks 1 and 2 are its two fixes. Batch 2 (the voice command, Agent and RPC) is a separate plan.

## Global Constraints

- Batch 1 touches the frontend and `e2e/` only: no Agent, backend or `packages/shared` change, no voice command.
- UI is Astryx only: no Tailwind, no shadcn. New copy is Vietnamese. Plain CSS files, as `app-header.css` and `voice-bars.css` do, are fine for layout and the canvas.
- The side panel is **in the layout and not modal**. Do not use Astryx `Drawer` or `BottomSheet`: they overlay the page and are modal by default, which blocks the mic and Kết thúc.
- Mic and Kết thúc stay usable while the panel is open. Cuộc nói and Ghi chú are mounted at all times, only hidden, so no transcript line is lost and the Notes keep polling.
- New status copy: `Gia sư đang chờ bạn bật mic.` Every other status line, and the hint `Mic đang tắt. Gia sư không nghe thấy bạn.`, stay exactly as they are. While the mic is off, the thinking and speaking lines are unchanged.
- Aura: colour `#0176fd` (sampled from the logo mark), `colorShift` 0.05, `blur` 0.2, pixel ratio capped at 2. It follows the app's light/dark mode (`useThemeMode`), draws one still frame when the Member prefers reduced motion, and is a still blue circle (`.aura-fallback`) when WebGL is unavailable. The lesson works in every case.
- Licences: the ported Aura GLSL and hook are Apache-2.0 (livekit/components-js). Keep a copy of the licence in the repo and put a prominent "modified" notice in every file derived from LiveKit. Do not copy LiveKit's 650-line `react-shader-toy.tsx` (it has `eslint-disable` lines); if any line of it is ever copied, keep its MIT header.
- Fix the code, never the scanner: no `NOSONAR`, `@ts-ignore`, ESLint or Sonar exclusions, lowered thresholds.
- Work on a new branch off `main`, `feat/tutor-screen-batch-1`, never on `main`; `brand.png` at the repo root stays untracked (ask the Member where the source file should live).
- `pnpm test:e2e` needs ports 3000, 5173 and 8081. The Member's dev stack may hold 3000 and 5173: ask before stopping it, never kill it unasked.

## Test Strategy

| Scenario                                                               | Unit                                                    | Integration                                                                              | E2E                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Logo and favicon, readable in light and dark mode                      | `BrandLogo` tests (Task 3)                              | `the header shows the logo on every page` (Task 3)                                       | `the logo and the favicon are there, in light and dark mode` (Task 10)              |
| The lesson screen shows only the aura, the status line and controls    | `AgentAura` and `ShaderCanvas` tests (Tasks 4-6)        | `the lesson screen starts with only the aura, the status line and the controls` (Task 9) | `the lesson screen shows only the aura, the status line and the controls` (Task 10) |
| The aura draws, and falls back when WebGL or motion is not available   | `ShaderCanvas` and `AgentAura` tests (Task 6)           | `the lesson works when WebGL is not available` (Task 9)                                  | `the aura draws something`, `the aura falls back to a still circle` (Task 10)       |
| Mic off: the status line waits for the mic; mic on: it listens again   | `AgentStatus` tests (Task 1)                            | `status line says the tutor waits for the mic while it is off` (Task 1)                  | `the status line says the tutor waits while the mic is off` (Task 10)               |
| Cuộc nói keeps its lines while closed, scrolls inside, "Xuống cuối"    | `useStickToBottom` and `TranscriptPanel` tests (Task 7) | `keeps the lines said while the panel is closed` (Task 9)                                | `Cuộc nói and Ghi chú open and close the panel…` (Task 10)                          |
| Ghi chú: count before opening, mark for new notes                      | `useUnseenNotes` tests (Task 9)                         | `marks new notes while the panel is closed…` (Task 9)                                    | the updated notes tests in `tutor-notes.spec.ts` (Task 10)                          |
| The panel does not block the controls; buttons toggle; ✕ and Esc close | `useSidePanel` and `SidePanel` tests (Task 8)           | `the controls stay usable while the panel is open` (Task 9)                              | `Cuộc nói and Ghi chú open and close the panel…` (Task 10)                          |
| Phone width: the panel sits between the aura and the controls          | — (jsdom loads no CSS)                                  | — (same)                                                                                 | `the lesson screen shows only…` at 375×667 (Task 10)                                |
| The menu underlines the page you are on                                | — (jsdom loads no Astryx stylesheet)                    | — (same)                                                                                 | `the nav underlines the page you are on, and only that one` (Task 2)                |

The nav row has its only test at the e2e level, so Task 2 writes it first and watches it fail there instead of Task 10.

**Unit run:** `pnpm test`
**Integration run:** `pnpm exec vitest run --project frontend test/conversation-page.spec.tsx test/app-header.spec.tsx`
**E2E run:** `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-27-tutor-screen-batch-1 pnpm test:e2e`
**E2E evidence:** `docs/superpowers/evidence/2026-11-27-tutor-screen-batch-1/` — a video, screenshot and trace of every test (git-ignored)

## Quality Gates

Base commit `95839a2`: `pnpm check` is green (753 tests, exit 0), so every gate is whole-project. `pnpm test` writes `apps/frontend/coverage/lcov.info`, which Sonar reads; the new code needs its tests so the coverage condition holds.

**Format run:** `pnpm format:check`
**Lint run:** `pnpm lint`
**Typecheck run:** `pnpm typecheck`
**Build run:** `pnpm --filter @open-lang/frontend build`
**Sonar run:** `pnpm sonar`

## Review Focus

- The uniforms change on every animation frame (volume): the WebGL program is built once, not per render. (Task 6 test.)
- The aura unmounts while its frame loop runs, or the tab is hidden: the loop stops, no draw happens after unmount, the context is released. (Task 6 tests.)
- A new transcript line arrives at the moment the Member has scrolled up to read: the view does not jump to the bottom. (Task 7 test.)
- Notes arrive while the panel is closed, then the Ghi chú tab is shown, then more arrive: the mark clears and comes back. (Task 9 test.)
- The Member switches light/dark mode while the aura is on screen: it follows without rebuilding the program. (Task 6 test.)

---

### Task 1: The status line knows the mic is off

**Files:**

- Create: `apps/frontend/src/conversation/use-mic-muted.ts`
- Modify: `apps/frontend/src/conversation/agent-status.tsx`, `apps/frontend/src/conversation/mic-toggle.tsx`
- Test: create `apps/frontend/test/agent-status.spec.tsx`; modify `apps/frontend/test/conversation-page.spec.tsx`

**Interfaces:**

- Produces: `useMicMuted(): boolean` in `use-mic-muted.ts`. True when the room is `ConnectionState.Connected` and the local microphone is not enabled (the rule `MicToggle` has inline today). Must be called inside a LiveKit room context.

- [ ] **Step 1: Write the failing unit tests** in `agent-status.spec.tsx`. Render `<AgentStatus agentState=… agentVoice={undefined} />` inside `<RoomContext value={liveKit.room}>`, with `createUnconnectedRoom()`, `liveKit.joins()` and `setMicrophoneEnabled(true)` as `mic-toggle.spec.tsx` does; read the line with `getStatusMessage()` from `./status-message`. Tests (names exact):
  - `says the tutor listens while the mic is on` — `agentState="listening"`: `Gia sư đang nghe bạn nói.`
  - `says the tutor waits for the mic while it is off, and listens again once it is on` — listening; `act(async () => liveKit.room.localParticipant.setMicrophoneEnabled(false))`: `Gia sư đang chờ bạn bật mic.`; then `setMicrophoneEnabled(true)` the same way: `Gia sư đang nghe bạn nói.`
  - `keeps the thinking and speaking lines while the mic is off` — mic off; `agentState="thinking"`: `Gia sư đang suy nghĩ.`; `"speaking"`: `Gia sư đang nói…`.
- [ ] **Step 2: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/agent-status.spec.tsx`
  Expected: the second test FAILS (the line is still `Gia sư đang nghe bạn nói.` with the mic off).

- [ ] **Step 3: Write the failing integration tests** in `conversation-page.spec.tsx`, next to `status line says Gia sư đang nghe bạn nói.`, using `renderConversationPage`, `pressStart`, `liveKit.agentJoins()`:
  - `status line says the tutor waits for the mic while it is off` — after joining, click `Tắt mic`, wait for `Mic đang tắt. Gia sư không nghe thấy bạn.`; `getByText('Gia sư đang chờ bạn bật mic.')` is visible and `queryByText('Gia sư đang nghe bạn nói.')` is absent; click `Bật mic`: `findByText('Gia sư đang nghe bạn nói.')` is visible and the waiting line is gone.
  - `status line keeps waiting for the mic when the browser refuses it` — mute, then `liveKit.setMicrophoneEnabled.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))`, click `Bật mic`, `await screen.findByRole('alert')`; the line is still `Gia sư đang chờ bạn bật mic.`.
- [ ] **Step 4: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/conversation-page.spec.tsx`
  Expected: both new tests FAIL; every older test passes.

- [ ] **Step 5: Implement.** `useMicMuted` from `useTrackToggle({ source: Track.Source.Microphone })` (its `enabled`) and `useConnectionState()`. In `mic-toggle.tsx` replace the inline `muted` with `useMicMuted()` and drop the imports it no longer needs. In `agent-status.tsx` call `useMicMuted()` and give `statusLine` a second parameter `isMicMuted: boolean`: only `listening` changes, to `Gia sư đang chờ bạn bật mic.` when muted.
- [ ] **Step 6: Run to verify they pass**

  Run: `pnpm exec vitest run --project frontend test/agent-status.spec.tsx test/conversation-page.spec.tsx test/mic-toggle.spec.tsx test/status-message.spec.tsx`
  Expected: PASS, no older test changed.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/conversation apps/frontend/test
git commit -m "fix(frontend): say the tutor waits for the mic while it is off"
```

### Task 2: The nav underlines the page you are on

**Files:**

- Create: `e2e/tests/nav.spec.ts`
- Modify: `apps/frontend/src/nav-link.tsx:20-27` (and its doc comment, which says the current page has no underline)

**Interfaces:**

- Consumes: `registerNewUser(page)` from `e2e/tests/users.ts`.

- [ ] **Step 1: Write the failing e2e test** `the nav underlines the page you are on, and only that one`: `page.goto('/')`, `registerNewUser(page)`, wait for the heading `Gia sư tiếng Anh của bạn`. `await page.mouse.move(0, 600)` so no link is hovered. In `getByRole('navigation', { name: 'Chính' })`: `Học` has `aria-current="page"` and CSS `text-decoration-line` `underline`; `Lịch sử` has no `aria-current` and `text-decoration-line` `none`.
- [ ] **Step 2: Run to verify it fails** (check ports 3000/5173/8081 first)

  Run: `docker compose up --detach --wait && pnpm --filter @open-lang/e2e exec playwright test nav.spec.ts`
  Expected: FAIL, `Học` is `none` and `Lịch sử` is `underline`.

- [ ] **Step 3: Implement** in `nav-link.tsx`: `hasUnderline={isActive}` (was `!isActive`); keep colors and weights. Rewrite the doc comment: the current page is in the primary text color, medium weight, underlined; the other links are not underlined until hovered.
- [ ] **Step 4: Run to verify it passes**

  Run: `pnpm --filter @open-lang/e2e exec playwright test nav.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/nav.spec.ts apps/frontend/src/nav-link.tsx
git commit -m "fix(frontend): underline the nav link of the page you are on"
```

### Task 3: Logo and favicon

**Files:**

- Create: `apps/frontend/src/brand/ol-mark-on-dark.png`, `apps/frontend/src/brand/ol-mark-on-light.png`, `apps/frontend/src/brand/brand-logo.tsx`, `apps/frontend/src/brand/brand-logo.css`, `apps/frontend/public/favicon.png`
- Modify: `apps/frontend/index.html`, `apps/frontend/src/app-header.tsx`, `apps/frontend/src/app-header.css`
- Test: create `apps/frontend/test/brand-logo.spec.tsx`, `apps/frontend/test/app-header.spec.tsx`

**Interfaces:**

- Produces: `BrandLogo(): ReactElement` — a link to `/` whose accessible name is `Open Lang`, showing the OL mark (decorative, `alt=""`) and the text `Open` (primary text colour) and `Lang` (`#0176fd`); the mark is `ol-mark-on-dark.png` in dark mode and `ol-mark-on-light.png` in light mode (`useThemeMode()`).
- Produces: the CSS variable `--app-header-height` in `app-header.css` (`4rem`; `7rem` below 640px), which Task 9 uses to clear the fixed header.

- [ ] **Step 1: Make the assets** from `/Users/devinnguyen/Documents/project/open-lang/brand.png` with the `icon-logo-extractor` skill. The mark is the speech bubble with three dots plus the "L" (the `OL` at the left of the image; the background `#01040c` is baked in, no alpha). `ol-mark-on-dark.png`: transparent background, dots white. `ol-mark-on-light.png`: the same with the three dots `#141a23`. About 256px tall. `favicon.png`: 64×64, the mark on a rounded square `#01040c`, so it reads on light and dark browser tabs. Check each PNG over a white and over a dark page: corners fully transparent, no dark halo around the blue edge.
- [ ] **Step 2: Write the failing unit tests** in `brand-logo.spec.tsx`, rendering `<MemoryRouter><ThemeModeProvider><BrandLogo /></ThemeModeProvider></MemoryRouter>` (`deviceUses` from `./device-mode` picks the mode):
  - `links to the home page and is named Open Lang` — `getByRole('link', { name: 'Open Lang' })` has `href` `/`.
  - `shows the mark made for a dark page in dark mode, and the one for a light page in light mode` — the `img` `src` contains `ol-mark-on-dark` after `deviceUses('dark')`, `ol-mark-on-light` after `deviceUses('light')`.
  - `the mark is decorative` — the `img` has `alt=""`.
- [ ] **Step 3: Write the failing integration test** in `app-header.spec.tsx`: `the header shows the logo on every page` — `renderApp('/sign-in')`: `within(screen.getByRole('banner')).getByRole('link', { name: 'Open Lang' })` is visible; after `signInAs(...)` the header still has it; from the Lịch sử page, clicking it shows the heading `Gia sư tiếng Anh của bạn`.
- [ ] **Step 4: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/brand-logo.spec.tsx test/app-header.spec.tsx`
  Expected: FAIL (`BrandLogo` is not defined; no logo in the header).

- [ ] **Step 5: Implement** `BrandLogo` and the header. `AppHeader` becomes a full-width fixed bar: `BrandLogo` at the inline start; the nav children, the mode switch and Sign out grouped at the inline end; `justify-content: space-between`; page background colour (`var(--color-background-body)`) so scrolled content does not show through; it still wraps on a narrow screen. Define `--app-header-height`. Add `<link rel="icon" type="image/png" href="/favicon.png" />` to `index.html`.
- [ ] **Step 6: Run to verify they pass**, plus the older header users

  Run: `pnpm exec vitest run --project frontend test/brand-logo.spec.tsx test/app-header.spec.tsx test/sign-out.spec.tsx test/mode-toggle.spec.tsx test/theme-mode.spec.tsx`
  Expected: PASS.

- [ ] **Step 7: Commit** (not `brand.png`)

```bash
git add apps/frontend/src/brand apps/frontend/public apps/frontend/index.html apps/frontend/src/app-header.tsx apps/frontend/src/app-header.css apps/frontend/test
git commit -m "feat(frontend): add the Open Lang logo and favicon"
```

### Task 4: Aura shader and WebGL program

**Files:**

- Create: `apps/frontend/src/aura/aura-shader.ts`, `apps/frontend/src/aura/webgl-program.ts`, `apps/frontend/src/aura/LICENSE-LiveKit-Apache-2.0.txt`, `apps/frontend/src/aura/NOTICE.md`
- Test: create `apps/frontend/test/webgl-program.spec.ts`

**Interfaces:**

- Produces, in `aura-shader.ts`: `AURA_FRAGMENT_SHADER: string` — the GLSL of LiveKit's Aura (the `shaderSource` in `agent-audio-visualizer-aura.tsx`, livekit/components-js commit `370cbca`), a Shadertoy-style `mainImage(out vec4, in vec2)`. It uses the float uniforms `uSpeed uBlur uScale uShape uFrequency uAmplitude uBloom uMix uSpacing uColorShift uVariance uSmoothing uMode`, the vec3 uniform `uColor`, and the built-ins `iTime` (float) and `iResolution` (vec2).
- Produces, in `webgl-program.ts`:
  - `type UniformValue = number | readonly [number, number, number]` and `type Uniforms = Readonly<Record<string, UniformValue>>`
  - `buildFragmentSource(shaderToySource: string, uniforms: Uniforms): string` — prepends `precision highp float;`, `uniform float iTime;`, `uniform vec2 iResolution;` and one declaration per uniform (`float` for a number, `vec3` for a triple); appends a `main()` that calls `mainImage(color, gl_FragCoord.xy)` and assigns `gl_FragColor`.
  - `interface GlProgram { draw(timeSeconds: number, width: number, height: number, uniforms: Uniforms): void; dispose(): void }`
  - `createGlProgram(gl: WebGLRenderingContext, fragmentSource: string): GlProgram | null` — `null` when compiling or linking fails (the shader is deleted; the log goes to `console.error`). It looks up each uniform location once, on first use. `draw` sets the viewport, `iTime`, `iResolution` and every uniform, then `drawArrays(TRIANGLE_STRIP, 0, 4)` over a full-screen quad. `dispose` deletes the program and the buffer.

- [ ] **Step 1: Write the failing tests** in `webgl-program.spec.ts` with a fake `gl` (an object of `vi.fn()` methods; `getShaderParameter` and `getProgramParameter` return true unless a test says otherwise):
  - `declares a uniform for every value, and the built-ins` — `buildFragmentSource('void mainImage(out vec4 c, in vec2 p){}', { uSpeed: 1, uColor: [0, 0.5, 1] })` contains `uniform float uSpeed;`, `uniform vec3 uColor;`, `uniform float iTime;`, `uniform vec2 iResolution;`, and ends with the `main()` wrapper.
  - `returns null, and deletes the shader, when the shader does not compile` — `getShaderParameter` false: `createGlProgram` is `null`, `deleteShader` called, `console.error` called once.
  - `returns null when the program does not link`.
  - `draws the quad with the time, the resolution and every uniform` — `uniform1f` called for `iTime` and `uSpeed`, `uniform2f` for `iResolution`, `uniform3f` for `uColor` with its three numbers, then `drawArrays(gl.TRIANGLE_STRIP, 0, 4)`.
  - `looks each uniform location up once, however often it draws` — three `draw` calls: `getUniformLocation` called once per uniform name.
  - `dispose deletes the program and the buffer`.
- [ ] **Step 2: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/webgl-program.spec.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** both modules. Download the licence into the repo: `curl -fsSL https://raw.githubusercontent.com/livekit/components-js/main/LICENSE -o apps/frontend/src/aura/LICENSE-LiveKit-Apache-2.0.txt`. Start `aura-shader.ts` with a comment: derived from `livekit/components-js` `packages/shadcn/components/agents-ui/agent-audio-visualizer-aura.tsx` (Apache-2.0, see `LICENSE-LiveKit-Apache-2.0.txt`), **modified**: moved into a TypeScript string, nothing else changed. `NOTICE.md` lists each derived file, its source and that it was modified.
- [ ] **Step 4: Run to verify they pass**

  Run: `pnpm exec vitest run --project frontend test/webgl-program.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/aura apps/frontend/test/webgl-program.spec.ts
git commit -m "feat(frontend): port LiveKit's Aura shader and add a small WebGL program"
```

### Task 5: Aura animation hook

**Files:**

- Modify: `apps/frontend/package.json`, `pnpm-lock.yaml` (the `motion` dependency)
- Create: `apps/frontend/src/aura/use-aura-animation.ts`
- Modify: `apps/frontend/src/aura/NOTICE.md`
- Test: create `apps/frontend/test/use-aura-animation.spec.ts`

**Interfaces:**

- Produces: `interface AuraAnimation { speed: number; scale: number; amplitude: number; frequency: number; brightness: number }` and `useAuraAnimation(state: AgentState | undefined, audioTrack?: TrackReference): AuraAnimation`. It is LiveKit's `useAgentAudioVisualizerAura` (livekit/components-js `packages/shadcn/hooks/agents-ui/use-agent-audio-visualizer-aura.ts`): state → targets, eased with `motion`'s `animate`, and `useTrackVolume(audioTrack, { fftSize: 512, smoothingTimeConstant: 0.55 })` from `@livekit/components-react`.
- Start values: speed 10, scale 0.2, amplitude 2, frequency 0.5, brightness 1.5. Targets by state:

| State                                    | speed | scale                          | amplitude | frequency | brightness                 |
| ---------------------------------------- | ----- | ------------------------------ | --------- | --------- | -------------------------- |
| `idle`, `failed`, `disconnected`         | 10    | 0.2                            | 1.2       | 0.4       | 1.0                        |
| `listening`, `pre-connect-buffering`     | 20    | 0.3 (spring)                   | 1.0       | 0.7       | pulses between 1.5 and 2.0 |
| `thinking`, `connecting`, `initializing` | 30    | 0.3                            | 0.5       | 1         | pulses between 0.5 and 2.5 |
| `speaking`                               | 70    | 0.3, then `0.2 + 0.2 * volume` | 0.75      | 1.25      | 1.5                        |

- [ ] **Step 1: Add the dependency, exact:** `pnpm view motion time --json`, take the newest `motion` release at least two weeks older than 2026-11-27, then `pnpm --filter @open-lang/frontend add --save-exact motion@<that version>`.
- [ ] **Step 2: Write the failing tests** in `use-aura-animation.spec.ts`, mocking `motion/react` (`useMotionValue`, `useMotionValueEvent`, `animate`) and `useTrackVolume` as LiveKit's own test does (`packages/shadcn/tests/use-agent-audio-visualizer-aura.test.ts`, Apache-2.0: say so in the header). Tests (names exact):
  - `starts from the default values` — `useAuraAnimation(undefined)` returns speed 10, scale 0.2, amplitude 2, frequency 0.5, brightness 1.5.
  - `maps each state to its speed` — `idle`/`failed`/`disconnected` 10; `listening`/`pre-connect-buffering` 20; `thinking`/`connecting`/`initializing` 30; `speaking` 70.
  - `follows a change of state` — rerender from `listening` to `speaking`: speed 20 then 70.
  - `grows the scale with the track volume while speaking` — `useTrackVolume` returns 0.5: `animate` is called with the target `0.2 + 0.2 * 0.5` and `{ duration: 0 }`.
  - `ignores the volume when the tutor is not speaking` — volume 0.8 with `listening`: no `{ duration: 0 }` call with `0.2 + 0.2 * 0.8`.
- [ ] **Step 3: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/use-aura-animation.spec.ts`
  Expected: FAIL (module not found).

- [ ] **Step 4: Implement** `use-aura-animation.ts`. Header comment: derived from LiveKit's hook (Apache-2.0), **modified**: renamed, takes a `TrackReference`, no `volume` override prop. Add it to `NOTICE.md`.
- [ ] **Step 5: Run to verify they pass**, and that nothing else broke

  Run: `pnpm exec vitest run --project frontend test/use-aura-animation.spec.ts && pnpm typecheck`
  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/package.json pnpm-lock.yaml apps/frontend/src/aura apps/frontend/test/use-aura-animation.spec.ts
git commit -m "feat(frontend): add the Aura animation hook"
```

### Task 6: ShaderCanvas and AgentAura

**Files:**

- Create: `apps/frontend/src/aura/shader-canvas.tsx`, `apps/frontend/src/aura/agent-aura.tsx`, `apps/frontend/src/aura/agent-aura.css`
- Modify: `apps/frontend/test/setup.ts`
- Test: create `apps/frontend/test/shader-canvas.spec.tsx`, `apps/frontend/test/agent-aura.spec.tsx`

**Interfaces:**

- Consumes: `AURA_FRAGMENT_SHADER`, `buildFragmentSource`, `createGlProgram`, `Uniforms` (Task 4); `useAuraAnimation` (Task 5); `useThemeMode()`.
- Produces: `ShaderCanvas(props: { fragmentShader: string; uniforms: Uniforms; isStill: boolean; onUnavailable: () => void; className?: string }): ReactElement` — a `<canvas>`. It builds the program once on mount, keeps the latest `uniforms` in a ref and draws them each frame from a `requestAnimationFrame` loop; it draws at pixel ratio `Math.min(devicePixelRatio ?? 1, 2)`; it pauses while `document.hidden` and while off-screen (`IntersectionObserver`, when it exists); with `isStill` it draws a single frame; it calls `onUnavailable` once when `getContext('webgl')` returns null or the program does not build; on unmount it cancels the frame, disposes the program and releases the context (`WEBGL_lose_context`).
- Produces: `AgentAura(props: { state: AgentState; audioTrack: TrackReference | undefined }): ReactElement` — `role="img"` named `Giọng nói của Gia sư`; draws `AURA_FRAGMENT_SHADER` with `uColor` `#0176fd` as `[r, g, b]` in 0-1, `uColorShift` 0.05, `uBlur` 0.2, `uShape` 1, `uBloom` 0, `uSpacing` 0.5, `uVariance` 0.1, `uSmoothing` 1, `uMode` 1 in light mode and 0 in dark, and `uSpeed uScale uAmplitude uFrequency uMix` from `useAuraAnimation` (`brightness` is `uMix`); it is still when `(prefers-reduced-motion: reduce)` matches; when the canvas reports unavailable it renders `<div className="aura-fallback">`, a still circle in `#0176fd`.

- [ ] **Step 1: Stub the canvas in the tests' setup.** In `test/setup.ts`, a `beforeAll` makes `HTMLCanvasElement.prototype.getContext` return `null` (jsdom prints "Not implemented" otherwise); tests that need a context override it for themselves.
- [ ] **Step 2: Write the failing tests** in `shader-canvas.spec.tsx` with a fake `gl` (as in Task 4), `getContext` returning it, and `requestAnimationFrame`/`cancelAnimationFrame` stubbed by a queue the test steps by hand:
  - `draws the uniforms it was given, each frame`
  - `builds the program once, however often the uniforms change` — rerender five times with new uniforms: `createProgram` called once, `draw` uses the latest values. (Review Focus.)
  - `stops drawing while the document is hidden, and resumes when it is visible again` — define `document.hidden`, dispatch `visibilitychange`.
  - `draws a single frame when it is still`
  - `calls onUnavailable, once, when WebGL is not available` and `calls onUnavailable when the shader does not compile`
  - `releases the program and the context when it unmounts, and draws nothing after` — step the queue after `unmount()`: no further `drawArrays`; `loseContext` called. (Review Focus.)
  - `draws at a pixel ratio of at most 2` — `devicePixelRatio` 3: the canvas width is `clientWidth * 2`.
- [ ] **Step 3: Write the failing tests** in `agent-aura.spec.tsx`, with a fake `gl` and `ThemeModeProvider` (`deviceUses` sets the mode):
  - `is an image named Giọng nói của Gia sư`
  - `draws the Aura shader in the brand blue` — the uniform `uColor` is `[1/255, 118/255, 253/255]` (`#0176fd`), `uBlur` 0.2, `uColorShift` 0.05.
  - `shows the still blue circle when WebGL is not available` — `getContext` null: `.aura-fallback` is in the document, the image role is still there.
  - `follows the light or dark mode without rebuilding the program` — `uMode` is 0 in dark and 1 in light; switching the mode through `useThemeMode().setMode` changes it, and `createProgram` was called once. (Review Focus.)
  - `draws a single frame when the Member prefers reduced motion` — stub `matchMedia` so `(prefers-reduced-motion: reduce)` matches.
- [ ] **Step 4: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/shader-canvas.spec.tsx test/agent-aura.spec.tsx`
  Expected: FAIL (modules not found).

- [ ] **Step 5: Implement** both components. Guard `matchMedia` and `IntersectionObserver` with `typeof … === 'function'` as `deviceMode()` does. `agent-aura.css`: the aura is a square, `width: min(60vmin, 22rem)`, centred; `.aura-fallback` a circle of the same size.
- [ ] **Step 6: Run to verify they pass**, and that the other suites still print no jsdom canvas errors

  Run: `pnpm exec vitest run --project frontend test/shader-canvas.spec.tsx test/agent-aura.spec.tsx && pnpm test`
  Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/aura apps/frontend/test
git commit -m "feat(frontend): draw the Aura with a small WebGL canvas"
```

### Task 7: Cuộc nói scrolls inside its own area

**Files:**

- Create: `apps/frontend/src/conversation/use-stick-to-bottom.ts`, `apps/frontend/src/conversation/transcript-panel.css`
- Modify: `apps/frontend/src/conversation/transcript-panel.tsx`
- Test: create `apps/frontend/test/use-stick-to-bottom.spec.tsx`; modify `apps/frontend/test/transcript-panel.spec.tsx`

**Interfaces:**

- Produces: `useStickToBottom(changeKey: unknown, isShown: boolean): { ref: RefObject<HTMLDivElement | null>; isAtBottom: boolean; scrollToBottom: () => void }`. The element follows the bottom until a `scroll` event leaves it more than 24px from the bottom; then it stops following. Whenever `changeKey` changes, or `isShown` becomes true, and it is following, it sets `scrollTop = scrollHeight`. `scrollToBottom()` scrolls and follows again.
- Changes: `TranscriptPanel` takes `{ isShown: boolean }` (required). The lines sit in `<div className="transcript-scroll" ref>` (`overflow-y: auto; min-height: 0; flex: 1`) and, when there are lines and `!isAtBottom`, a `Xuống cuối` button (Astryx `Button`, `size="sm"`, `variant="secondary"`) calls `scrollToBottom`.

- [ ] **Step 1: Write the failing tests** in `use-stick-to-bottom.spec.tsx`, rendering a small component that attaches `ref` to a div, with `scrollHeight` 1000 and `clientHeight` 200 defined by `Object.defineProperty` (jsdom has no layout) and `scrollTop` writable:
  - `scrolls to the bottom when the change key changes`
  - `stops following once the Member scrolls up` — `scrollTop = 100`, dispatch `scroll`: `isAtBottom` false.
  - `does not move the view when the change key changes while the Member has scrolled up` — `scrollTop` stays 100. (Review Focus.)
  - `scrollToBottom goes to the bottom and follows again`
  - `scrolls to the bottom when it is shown after lines arrived while it was hidden`
- [ ] **Step 2: Write the failing tests** in `transcript-panel.spec.tsx` (pass `isShown` in the existing tests too): `shows Xuống cuối only when there are lines and the Member is not at the bottom`, and `Xuống cuối brings back the newest line`.
- [ ] **Step 3: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/use-stick-to-bottom.spec.tsx test/transcript-panel.spec.tsx`
  Expected: FAIL.

- [ ] **Step 4: Implement** the hook and the panel. `changeKey` for the panel is its `lines`.
- [ ] **Step 5: Run to verify they pass**

  Run: `pnpm exec vitest run --project frontend test/use-stick-to-bottom.spec.tsx test/transcript-panel.spec.tsx`
  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/conversation apps/frontend/test
git commit -m "feat(frontend): Cuộc nói scrolls inside its own area"
```

### Task 8: The side panel

**Files:**

- Create: `apps/frontend/src/conversation/use-side-panel.ts`, `apps/frontend/src/conversation/side-panel.tsx`, `apps/frontend/src/conversation/side-panel.css`
- Test: create `apps/frontend/test/side-panel.spec.tsx`

**Interfaces:**

- Produces: `type PanelId = 'transcript' | 'notes'`; `useSidePanel(): { panel: PanelId | null; toggle(clicked: PanelId): void; close(): void }` — `toggle` opens `clicked` when the panel is closed, closes it when `clicked` is the open one, switches to `clicked` when the other is open.
- Produces: `SidePanel(props: { panel: PanelId | null; onSelect(panel: PanelId): void; onClose(): void; noteCount: number; transcript: ReactNode; notes: ReactNode }): ReactElement` — an `<aside aria-label="Cuộc nói và ghi chú">`, `hidden` when `panel === null`, never unmounted. Inside: Astryx `TabList` (`role="tablist"`) with the tabs `Cuộc nói` and `Ghi chú` (the second shows `noteCount` in a `Badge` when above 0), an icon-only Astryx `Button` named `Đóng` (`isIconOnly`, `<Icon icon="close" />`), and two `role="tabpanel"` containers. Both are always in the DOM; the one that is not selected has `hidden`. `Escape` pressed inside the aside calls `onClose`. Each tab's `panelId` points at its panel, as `ReportTabs` does.

- [ ] **Step 1: Write the failing tests** in `side-panel.spec.tsx`:
  - `useSidePanel`: `opens the panel the Member clicked`, `closes when the open panel is clicked again`, `switches when the other panel is clicked`, `close closes`.
  - `SidePanel`: `is hidden while closed but keeps both panels in the document` (the `transcript` and `notes` text are in the document and `not.toBeVisible()`); `shows the selected tab and its panel only`; `shows the note count on the Ghi chú tab`; `selecting the other tab calls onSelect`; `Đóng calls onClose`; `Escape inside the panel calls onClose`.
- [ ] **Step 2: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/side-panel.spec.tsx`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** both. `side-panel.css`: the aside is a flex column (`min-height: 0`), the tabpanels fill it (`flex: 1; min-height: 0; overflow-y: auto`), a border and the Astryx card background tokens.
- [ ] **Step 4: Run to verify they pass**

  Run: `pnpm exec vitest run --project frontend test/side-panel.spec.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/conversation apps/frontend/test/side-panel.spec.tsx
git commit -m "feat(frontend): add the side panel for Cuộc nói and Ghi chú"
```

### Task 9: The new lesson screen

**Files:**

- Create: `apps/frontend/src/conversation/controls-bar.tsx`, `apps/frontend/src/conversation/use-unseen-notes.ts`, `apps/frontend/src/conversation/conversation-layout.css`
- Modify: `apps/frontend/src/conversation/conversation-session.tsx`, `apps/frontend/src/conversation/agent-status.tsx`, `apps/frontend/src/conversation/conversation-page.tsx`
- Delete: `apps/frontend/src/conversation/voice-bars.css`
- Test: create `apps/frontend/test/controls-bar.spec.tsx`, `apps/frontend/test/use-unseen-notes.spec.tsx`; modify `apps/frontend/test/conversation-page.spec.tsx` and any other spec that fails because it expects the old layout

**Interfaces:**

- Consumes: `AgentAura` (Task 6), `TranscriptPanel({ isShown })` (Task 7), `SidePanel`, `useSidePanel`, `PanelId` (Task 8), `useMicMuted` (Task 1), `--app-header-height` (Task 3).
- Produces: `AgentStatusLine({ agentState }: { agentState: AgentState }): ReactElement` in `agent-status.tsx` — only the `role="status"` line (`AgentStatus` and its bar visualizer are removed; the line's text and the Task 1 mic rule are unchanged).
- Produces: `useUnseenNotes(noteCount: number, isNotesShown: boolean): boolean` — true while `noteCount` is above the number the Member has seen. The seen number becomes `noteCount` whenever `isNotesShown` is true.
- Produces: `ControlsBar(props: { agentState: AgentState; panel: PanelId | null; onTogglePanel(panel: PanelId): void; noteCount: number; hasUnseenNotes: boolean; onEnd(): void }): ReactElement` — the status line above one row of buttons: `MicToggle`, `Cuộc nói`, `Ghi chú` (a `Badge` with `noteCount` when above 0, `variant="blue"` when `hasUnseenNotes`, else `neutral`), `Kết thúc`. The two panel buttons carry `aria-expanded` (true when their panel is the open one).
- Layout (CSS classes in `conversation-layout.css`): `.conversation-screen` is `height: 100svh; display: flex; flex-direction: column; padding-top: var(--app-header-height); box-sizing: border-box; overflow: hidden`. `.conversation-body` is `flex: 1; min-height: 0; display: grid`, one column with the aura stage and the panel below it; from 640px, with `data-panel-open="true"`, two columns (`minmax(0, 1fr) minmax(20rem, 28rem)`). `.conversation-stage` centres the `AgentAura`. The controls bar is the last child and always inside the viewport.

- [ ] **Step 1: Write the failing unit tests.** `use-unseen-notes.spec.tsx`: `is false while nothing has arrived`; `is true when notes arrive while the Ghi chú tab is not shown`; `clears when the Ghi chú tab is shown`; `stays false for notes that arrive while the tab is shown`; `comes back for notes that arrive after the tab is hidden again`. (Review Focus.) `controls-bar.spec.tsx`: `has the buttons Tắt mic, Cuộc nói, Ghi chú and Kết thúc, with the status line above them`; `marks the button of the open panel with aria-expanded`; `shows the note count on Ghi chú, in blue when there are unseen notes`; `calls onTogglePanel with the panel of the button pressed`; `Kết thúc calls onEnd`.
- [ ] **Step 2: Update the existing integration tests** in `conversation-page.spec.tsx` that encode the old layout, and add the new ones (names exact). Replace `shows the transcript and the notes side by side on a wide screen`, `shows tabs Cuộc nói and Ghi chú with the count at phone width`, `keeps the transcript when the layout changes` and `the in-session screen shows the voice bars, the status, the controls and the two panels…` with:
  - `the lesson screen starts with only the aura, the status line and the controls` — the image `Giọng nói của Gia sư`, the status line `Gia sư đang nghe bạn nói.`, the buttons in order `Tắt mic`, `Cuộc nói`, `Ghi chú`, `Kết thúc`; `queryByRole('tablist')` is not visible; no heading is visible. (Do not match the whole `main` text: hidden panels are in it.)
  - `Cuộc nói opens the transcript and Ghi chú opens the notes, and each button closes its own tab` — `aria-expanded`, the selected tab, and the panel text visible or not.
  - `keeps the lines said while the panel is closed` — `liveKit.agentSays(...)`, `memberSays(...)` while closed, then open Cuộc nói: both lines are there; close, switch tabs, resize the window: still there.
  - `shows the count of notes on Ghi chú before the panel is opened` — `backendHasNotes('conversation-1', [two notes])`: `findByRole('button', { name: /^Ghi chú/ })` contains `2`.
  - `marks new notes while the panel is closed, and clears the mark when the Ghi chú tab is shown` — follow the polling pattern of `notes-panel.spec.tsx` (`NOTES_POLL_MILLISECONDS`). (Review Focus.)
  - `the controls stay usable while the panel is open` — with the panel open: `Tắt mic` mutes, `Kết thúc` ends the session and calls `onEnded`.
  - `Escape and Đóng close the panel`.
  - `the lesson works when WebGL is not available` — the setup stub already returns null: `.aura-fallback` is in the document and the status line and buttons work.
    Two more changes the new screen forces. `AgentAura` reads the light/dark mode, so every spec that renders `ConversationPage` or `ConversationSession` directly must wrap it in `ThemeModeProvider`: do it once, in the shared `withQueryClient` helper or in a new helper beside it. And `agent-status.spec.tsx` (Task 1) now renders `<AgentStatusLine agentState=… />` with the same three tests and assertions. Fix every other spec the old layout breaks (`conversation-page-failures.spec.tsx`, `status-message.spec.tsx`) by changing only what it asserts about the layout, never what it checks about behaviour.
- [ ] **Step 3: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/use-unseen-notes.spec.tsx test/controls-bar.spec.tsx test/conversation-page.spec.tsx`
  Expected: the new and rewritten tests FAIL; the rest of the file still passes.

- [ ] **Step 4: Implement.** Split `agent-status.tsx` into `AgentStatusLine`. In `conversation-session.tsx` render, inside `SessionProvider`: `.conversation-screen` > `.conversation-body[data-panel-open]` > (`.conversation-stage` with `AgentAura state={agent.state} audioTrack={agent.microphoneTrack}`, then `SidePanel` with `transcript={<TranscriptPanel isShown={panel === 'transcript'} />}` and `notes={<Notes roomName={roomName} />}`), then `ControlsBar`, then `RoomAudioRenderer`. Drop `ConversationPanels`, `Panel` and the `useMediaQuery` use. The panel state is `useSidePanel()`; `SidePanel`'s `onSelect` and `ControlsBar`'s `onTogglePanel` are both its `toggle` (the tab of the open panel is already selected, so a tab press only ever switches); `noteCount` is `useNoteCount(roomName)`; `hasUnseenNotes` is `useUnseenNotes(noteCount, panel === 'notes')`. In `conversation-page.tsx` the `Stack` keeps centring the Start panel, but the running session is not centred inside it (it fills the screen itself). Delete `voice-bars.css`.
- [ ] **Step 5: Run to verify they pass**, then the whole frontend suite

  Run: `pnpm exec vitest run --project frontend`
  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend
git commit -m "feat(frontend): the lesson screen with the aura, a side panel and bottom controls"
```

### Task 10: End-to-end scenarios

**Files:**

- Modify: `e2e/tests/tutor-notes.spec.ts`
- Create: `e2e/tests/lesson-screen.spec.ts`

**Interfaces:**

- Consumes: `startConversation(page)`, `statusLine(page)`, `noteGroup(...)` in `tutor-notes.spec.ts` (move what the new file needs into a small shared helper rather than copying it); `registerNewUser(page)` from `e2e/tests/users.ts`.

Adds no production code. Ports 3000/5173/8081 must be free (see Global Constraints).

- [ ] **Step 1: Make the existing e2e tests match the new layout.** In `tutor-notes.spec.ts`: `the session shows an empty transcript before anyone speaks` presses `Cuộc nói` for the transcript text, then `Ghi chú` for the notes text; `a note the Agent saves appears in the notes panel` and `the notes panel survives a failing poll` press `Ghi chú` before they look for the notes. Run: `pnpm --filter @open-lang/e2e exec playwright test tutor-notes.spec.ts` — Expected: PASS.
- [ ] **Step 2: Write the e2e tests** in `lesson-screen.spec.ts` and `tutor-notes.spec.ts`, from the spec's wording (names exact):
  - `the logo and the favicon are there, in light and dark mode` — the link `Open Lang` is visible and its `img` has `naturalWidth` above 0 in both modes (flip the mode switch); `link[rel="icon"]` has an `href` that answers 200 with `image/png`; a screenshot of the header in each mode.
  - `the lesson screen shows only the aura, the status line and the controls` — at 1280×800 and at 375×667, after `startConversation`: `Cuộc nói` and `Ghi chú` panels not visible; `document.documentElement.scrollHeight` is at most `innerHeight`; the four buttons are inside the viewport.
  - `the aura draws something` — a screenshot of the aura element has more than one colour, and the test fails if it is blank (decode the PNG; choose the tool).
  - `the aura falls back to a still circle` — `addInitScript` makes `getContext('webgl')` return null: the fallback circle is visible and the lesson (status line, mic button) still works.
  - `Cuộc nói and Ghi chú open and close the panel, and mic and Kết thúc keep working while it is open` — each button opens its tab and closes it when pressed again; `Đóng` and `Escape` close it; with the panel open, `Tắt mic` still mutes and the panel's bounding box does not intersect the controls' (wide), and the controls are in the viewport (phone).
  - `the status line says the tutor waits while the mic is off` (in `tutor-notes.spec.ts`): `startConversation`; click `Tắt mic`; `statusLine(page)` has text `Gia sư đang chờ bạn bật mic.` and `getByText('Gia sư đang nghe bạn nói.')` has count 0; click `Bật mic`: `Gia sư đang nghe bạn nói.` again.
- [ ] **Step 3: Run them**

  Run: `pnpm --filter @open-lang/e2e exec playwright test lesson-screen.spec.ts tutor-notes.spec.ts`
  Expected: PASS.

- [ ] **Step 4: Prove they can fail**, one at a time, then restore each file with `git checkout`: make `ShaderCanvas` skip `drawArrays` (`the aura draws something` FAILS); make `SidePanel` ignore `hidden` (`the lesson screen shows only…` FAILS); make `AgentStatusLine` ignore the mic (`the status line says the tutor waits…` FAILS); make the side panel `position: fixed` over the controls (`Cuộc nói and Ghi chú open and close…` FAILS).
- [ ] **Step 5: Commit**

```bash
git add e2e/tests
git commit -m "test(e2e): the new lesson screen"
```

Then `verification-before-completion`: run the E2E run, `pnpm check` and `pnpm sonar` as written above, and report their output. Also report, as not verified by this batch: the voice command (batch 2) and the look of the aura on the Member's own screen.
