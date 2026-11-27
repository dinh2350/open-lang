# Tutor screen: honest status line and nav marker Implementation Plan

> **Superseded (2026-11-27):** these two fixes now belong to batch 1 of [the tutor screen redesign](../specs/2026-11-27-tutor-screen-redesign-design.html). Do not execute this plan on its own; its test names and steps are reused there.

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two UI bugs on the tutor screen: the status line says the tutor is listening while the Member's mic is off, and the nav marks the page you are on the wrong way round.

**Architecture:** One shared hook, `useMicMuted`, owns the rule "the mic is off in a joined room", so the mic hint under the button and the status line above it can never disagree. The nav fix flips one prop on `NavLink`. Nothing else moves.

**Tech Stack:** React 19, `@livekit/components-react`, Astryx (`@astryxdesign/core`, StyleX), Vitest + Testing Library (jsdom), Playwright.

**Spec:** none written. The user opted out of the brainstorming questions on 2026-11-27 by accepting the offer to fix findings 1 and 4 directly, so the findings of that conversation are the spec: [agent-status.tsx:10-21](../../../apps/frontend/src/conversation/agent-status.tsx) (finding 1) and [nav-link.tsx:20-27](../../../apps/frontend/src/nav-link.tsx) (finding 4).

## Global Constraints

- Scope is these two bugs only. Do not touch the `Dark mode` / `Sign out` labels, add a logo, or change the orb, the Kết thúc button, the mic button's look, or any layout.
- New copy is Vietnamese and says "mic", as the buttons do: `Gia sư đang chờ bạn bật mic.`
- Every other status line stays exactly as it is: `Gia sư đang nghe bạn nói.`, `Gia sư đang suy nghĩ.`, `Gia sư đang nói…`, `Đang chờ Gia sư…`. The mic hint `Mic đang tắt. Gia sư không nghe thấy bạn.` stays exactly as it is.
- Fix the code, never the scanner: no `NOSONAR`, `@ts-ignore`, ESLint or Sonar exclusions, lowered thresholds.
- UI is Astryx only. Work on a new branch off `main` (`fix/tutor-status-and-nav`), never on `main`.
- Task 3 and the final gates run `pnpm test:e2e`, which needs ports 3000, 5173 and 8081. At the time of writing the user's own dev stack holds 3000 and 5173. Ask the user before stopping it; never kill it unasked.

## Test Strategy

| Scenario                                                                                                                             | Unit                                                         | Integration                                                             | E2E                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The Member turns the mic off: the status line stops saying the tutor listens and says it waits for the mic; mic on: it listens again | `AgentStatus` tests in `agent-status.spec.tsx` (Task 1)      | `status line says the tutor waits for the mic while it is off` (Task 1) | `the status line says the tutor waits while the mic is off` (Task 3) |
| The nav underlines the page you are on, and only that one                                                                            | — (jsdom loads no Astryx stylesheet, so no underline to see) | — (same reason)                                                         | `the nav underlines the page you are on, and only that one` (Task 2) |

The nav row has its only test at the e2e level, so Task 2 writes it first and watches it fail (red-green there) instead of Task 3.

**Unit run:** `pnpm test`
**Integration run:** `pnpm exec vitest run --project frontend test/conversation-page.spec.tsx`
**E2E run:** `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-27-tutor-screen-status-and-nav pnpm test:e2e`
**E2E evidence:** `docs/superpowers/evidence/2026-11-27-tutor-screen-status-and-nav/` — a video, screenshot and trace of every test (git-ignored)

## Quality Gates

Base commit `95839a2`: `pnpm check` is green (753 tests, exit 0), so every gate is whole-project.

**Format run:** `pnpm format:check`
**Lint run:** `pnpm lint`
**Typecheck run:** `pnpm typecheck`
**Build run:** `pnpm --filter @open-lang/frontend build`
**Sonar run:** `pnpm sonar`

## Review Focus

- The mic is off while the tutor is thinking or speaking: those lines keep their own text, not the new one. (Task 1 unit test.)
- The browser refuses to turn the mic back on: the Member is still muted, so the line stays `Gia sư đang chờ bạn bật mic.`. (Task 1 integration test.)
- The inactive nav link still underlines on hover (an Astryx default, kept on purpose), so the e2e test moves the pointer away before it reads the underline. (Task 2.)
- Not tested, on purpose: the Admin nav uses the same `NavLink`, so its current page gets the new marker too. It is the same component and prop, and its `aria-current` test already exists in `admin-users.spec.tsx`.

---

### Task 1: The status line knows the mic is off

**Files:**

- Create: `apps/frontend/src/conversation/use-mic-muted.ts`
- Modify: `apps/frontend/src/conversation/agent-status.tsx`
- Modify: `apps/frontend/src/conversation/mic-toggle.tsx`
- Test: create `apps/frontend/test/agent-status.spec.tsx`; modify `apps/frontend/test/conversation-page.spec.tsx`

**Interfaces:**

- Produces: `useMicMuted(): boolean` in `use-mic-muted.ts`. True when the room is `ConnectionState.Connected` and the local microphone is not enabled (the rule `MicToggle` used inline for `muted`). Must be called inside a LiveKit room context.

- [ ] **Step 1: Write the failing unit tests** in `agent-status.spec.tsx`. Render `<AgentStatus agentState=… agentVoice={undefined} />` inside `<RoomContext value={liveKit.room}>`, with `createUnconnectedRoom()`, `liveKit.joins()` and `setMicrophoneEnabled(true)` as `mic-toggle.spec.tsx` does. Read the line with `getStatusMessage()` from `./status-message`. Tests (names exact):
  - `says the tutor listens while the mic is on` — `agentState="listening"`: line is `Gia sư đang nghe bạn nói.`
  - `says the tutor waits for the mic while it is off, and listens again once it is on` — listening, mic on, then `act(async () => liveKit.room.localParticipant.setMicrophoneEnabled(false))`: line is `Gia sư đang chờ bạn bật mic.`; then `setMicrophoneEnabled(true)` the same way: line is `Gia sư đang nghe bạn nói.` again.
  - `keeps the thinking and speaking lines while the mic is off` — mic off; rerender with `agentState="thinking"`: `Gia sư đang suy nghĩ.`; with `"speaking"`: `Gia sư đang nói…`.
- [ ] **Step 2: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/agent-status.spec.tsx`
  Expected: the second test FAILS (line is still `Gia sư đang nghe bạn nói.` with the mic off); the first and third may pass.

- [ ] **Step 3: Write the failing integration tests** in `conversation-page.spec.tsx`, next to `status line says Gia sư đang nghe bạn nói.`, using `renderConversationPage`, `pressStart`, `liveKit.agentJoins()` as the tests there do:
  - `status line says the tutor waits for the mic while it is off` — after joining, click `Tắt mic`, wait for `Mic đang tắt. Gia sư không nghe thấy bạn.`. Then `screen.getByText('Gia sư đang chờ bạn bật mic.')` is visible and `queryByText('Gia sư đang nghe bạn nói.')` is absent. Click `Bật mic`: `findByText('Gia sư đang nghe bạn nói.')` is visible and the waiting line is absent.
  - `status line keeps waiting for the mic when the browser refuses it` — mute as above, then `liveKit.setMicrophoneEnabled.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))`, click `Bật mic`, `await screen.findByRole('alert')`; the line is still `Gia sư đang chờ bạn bật mic.`.
- [ ] **Step 4: Run to verify they fail**

  Run: `pnpm exec vitest run --project frontend test/conversation-page.spec.tsx`
  Expected: both new tests FAIL; every older test passes.

- [ ] **Step 5: Implement.** Create `useMicMuted` in `use-mic-muted.ts` from `useTrackToggle({ source: Track.Source.Microphone })` (its `enabled`) and `useConnectionState()`. In `mic-toggle.tsx` replace the inline `muted` with `useMicMuted()` and drop the imports and variable it no longer needs. In `agent-status.tsx` call `useMicMuted()` and give `statusLine` a second parameter, `isMicMuted: boolean`: only the `listening` case changes, to `Gia sư đang chờ bạn bật mic.` when `isMicMuted`.
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

- [ ] **Step 1: Write the failing e2e test** `the nav underlines the page you are on, and only that one` in `nav.spec.ts`: `page.goto('/')`, `registerNewUser(page)`, wait for the heading `Gia sư tiếng Anh của bạn`. In `getByRole('navigation', { name: 'Chính' })`, take the links `Học` and `Lịch sử`. `await page.mouse.move(0, 600)` first, so no link is hovered. Assert `Học` has `aria-current="page"` and CSS `text-decoration-line` `underline`; `Lịch sử` has no `aria-current` and `text-decoration-line` `none`.
- [ ] **Step 2: Run to verify it fails.** Check ports 3000/5173/8081 first (Global Constraints).

  Run: `docker compose up --detach --wait && pnpm --filter @open-lang/e2e exec playwright test nav.spec.ts`
  Expected: FAIL, `Học` is `none` and `Lịch sử` is `underline`.

- [ ] **Step 3: Implement** in `nav-link.tsx`: `hasUnderline={isActive}` (was `!isActive`); keep colors and weights. Rewrite the doc comment: the current page shows in the primary text color, medium weight, underlined; the other links are not underlined until hovered.
- [ ] **Step 4: Run to verify it passes**

  Run: `pnpm --filter @open-lang/e2e exec playwright test nav.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/nav.spec.ts apps/frontend/src/nav-link.tsx
git commit -m "fix(frontend): underline the nav link of the page you are on"
```

### Task 3: End-to-end scenarios

**Files:**

- Modify: `e2e/tests/tutor-notes.spec.ts` (after the `mic button mutes and unmutes…` test, line 190)

**Interfaces:**

- Consumes: `startConversation(page)` and `statusLine(page)` in the same file.

- [ ] **Step 1: Write the e2e test** `the status line says the tutor waits while the mic is off`: `startConversation(page)`; click `Tắt mic`; expect `statusLine(page)` to have text `Gia sư đang chờ bạn bật mic.` and `page.getByText('Gia sư đang nghe bạn nói.')` to have count 0; click `Bật mic`; expect the status line `Gia sư đang nghe bạn nói.` again.
- [ ] **Step 2: Run it**

  Run: `pnpm --filter @open-lang/e2e exec playwright test tutor-notes.spec.ts -g "tutor waits while the mic is off"`
  Expected: PASS.

- [ ] **Step 3: Prove it can fail.** Temporarily make `statusLine` in `agent-status.tsx` ignore `isMicMuted`; run the same command. Expected: FAIL. Restore the file (`git checkout apps/frontend/src/conversation/agent-status.tsx`).
- [ ] **Step 4: Commit**

```bash
git add e2e/tests/tutor-notes.spec.ts
git commit -m "test(e2e): the status line says the tutor waits while the mic is off"
```

Then `verification-before-completion`: run the E2E run, then `pnpm check` and `pnpm sonar` as written above, and report their output.
