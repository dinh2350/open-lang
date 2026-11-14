# 04: Conversation page handles failures

**What to build:** When something stops a Conversation from working, the person sees a clear message instead of silence. This covers three cases: they deny microphone access, the Room Token request fails, or the Agent doesn't join in time. In each case they can try Start again. See the spec's Conversation page decisions and user stories 31 and 38.

**Blocked by:** 01 (Anonymous Conversation tracer bullet), 02 (SonarQube quality gate)

**Status:** ready-for-agent

- [ ] Microphone access denied: the page explains how to allow the microphone, and the Conversation doesn't start.
- [ ] Room Token request fails (network error or non-2xx response): the page shows an error and the person can press Start again.
- [ ] The Agent doesn't join within a timeout (default 15 seconds, configurable in the frontend): the page shows an "Agent unavailable" message and the Conversation ends.
- [ ] After any of these failures, pressing Start begins a fresh attempt with a new Room Token.
- [ ] S3 tests cover each failure, using MSW for `/api` and a real `livekit-client` Room that never connects. Simulate microphone denial and the Agent's absence through that Room, not by mocking internal components.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.

## Comments

### 2026-11-14, implementer (branch `ticket/04-conversation-failures`)

**Result.** The Conversation page handles all three failures, and 8 new S3 tests in `frontend/test/conversation-page-failures.spec.tsx` cover them. `pnpm check` passes. `pnpm sonar` passes the gate: coverage 92.8%, duplication 0.0%, A ratings, 0 issues. S4 (`pnpm test:e2e`) still passes.

**Security Hotspots: none.** SonarQube reported 0.

**How it works:**

- **Microphone denied.** `useSession().start()` rejects with the browser's `NotAllowedError`; livekit-client rethrows the `getUserMedia` error unchanged. The page checks it with `MediaDeviceFailure.getFailure` and explains how to allow the microphone.
- **Any other Start failure** (Room Token network error or non-2xx, a malformed token response, a LiveKit connect error) shows "Couldn't start the Conversation. Press Start to try again." The cause goes to `console.error`.
- **Agent timeout.** `useSession` has its own Agent timeout (`agentConnectTimeoutMilliseconds`, library default 20 s); the page sets it to 15 s. When `useAgent(session).state` becomes `failed`, the page shows "Agent unavailable, so the Conversation has ended."
- **A failed Conversation leaves its room** through `session.end()`, even when the room finishes connecting after the failure: `useSession` connects and asks for the microphone in parallel. `end()` fetches a new Room Token, so the next Start uses a new one.

**Decisions and deviations for review:**

1. **"Configurable in the frontend"** is an optional `agentJoinTimeoutMilliseconds` prop on `ConversationPage`, defaulting to 15 000. `main.tsx` doesn't pass it, so changing it means a code change. I didn't add a `VITE_` env variable: it would need a validated config module and a change to `main.tsx`, which ticket 07 rewrites. Say if you want one.
2. **The "Agent unavailable" path reacts to the Agent's `failed` state.** `@livekit/components-react` also enters that state when the Agent joins but never reaches `listening`, or leaves the room mid-Conversation. All three show "Agent unavailable" and end the Conversation; only the timeout is tested.
3. **Each `ConversationPage` creates its own Room Token source.** `createRoomTokenSource()` replaces the module-level `roomTokenSource`. The shared source cached its last Room Token across page instances, so tests in one file reused each other's Room Tokens. In production, a remounted page fetches a fresh Room Token on mount. Ticket 07 (auth on `/api/token`) changes the same file.
4. **S3 harness change.** The `afterEach` in `frontend/test/setup.ts` now awaits `allRequestsAnswered()` (new in `frontend/test/backend.ts`), which waits until MSW has answered every request. When a Conversation ends or the page unmounts, `useSession` fetches the next Room Token in the background without awaiting it. If the next test made `/api/token` fail, it caught that request, which became an unhandled rejection. Without the wait this failed 5 runs out of 5; with it, 0 out of 8.
5. **Simulating microphone denial.** `createUnconnectedRoom().denyMicrophoneAccess()` lets the Room's real `setMicrophoneEnabled` run. jsdom gets a `navigator.mediaDevices.getUserMedia` that rejects with `NotAllowedError` once the room connects, which is when a person would answer the prompt. `allowMicrophoneAccess()` puts the stub back. For the Agent's absence, the test never calls `agentJoins()`. The timeout tests use Vitest fake timers (`shouldAdvanceTime`): the page still waits at 14 s and shows "Agent unavailable" at 15 s.
6. The tests for pressing Start again after each failure passed on their first run, because the earlier slices already delivered that behavior.
7. When the Room Token request fails on mount, livekit-client logs `WARNING: Room.prepareConnection failed`. That warning comes from the library and shows up in the test output.

**Open issue (needs a human decision).** After a Room Token failure in a real browser, the microphone `useSession` started in parallel stays captured. livekit-client waits up to 15 s for the engine to connect, then stops the track. Until then the browser's microphone indicator stays on, unless the User presses Start again. S3 can't see this (jsdom has no media), and S4 doesn't cover it. Releasing it early would mean working around the library's pending publication.
