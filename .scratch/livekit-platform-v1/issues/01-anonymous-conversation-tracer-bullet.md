# 01: Anonymous Conversation tracer bullet

**What to build:** A developer starts the whole stack locally. A person opens the app and presses Start, and they join a brand-new private room. The Agent, running on the keyless `fake` Provider, is dispatched into that room and joins it. Pressing End leaves the room. This slice puts every package and the Docker Compose stack in place. It also proves the biggest risk early: that WebRTC media flows between the browser, the Agent and a LiveKit server running in Docker on macOS. Nobody signs in yet. See the spec at `.scratch/livekit-platform-v1/spec.md` (Implementation Decisions: Repository and runtime, LiveKit server, Shared contract module, Room Token endpoint) and ADR 0001.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The pnpm workspace has five packages: frontend, backend, Agent, shared, and end-to-end tests. All are TypeScript.
- [ ] Node 24 and pnpm 10 are pinned.
- [ ] The root scripts `dev`, `test` and `test:e2e` work.
- [ ] `test` runs a single root Vitest projects config.
- [ ] Docker Compose starts the LiveKit server in dev mode. It binds all interfaces, advertises node IP `127.0.0.1`, and publishes 7880, 7881/tcp and 7882/udp.
- [ ] Each app has a committed example env file. The real env files are git-ignored.
- [ ] The shared package holds zod schemas for the token request and response in LiveKit's standard token endpoint shape: snake_case request fields, and a `201` response with `server_url` and `participant_token`. A compile-time check against `livekit-client`'s token source payload types fails the build if they drift.
- [ ] The backend is NestJS 12 (ESM) with a global `/api` prefix and a health endpoint.
- [ ] `POST /api/token` returns `201` with the LiveKit URL and a Room Token for:
  - a new random room name on every request;
  - a random participant identity;
  - an explicit Agent dispatch for `AGENT_NAME` in the room configuration;
  - join, publish and subscribe grants for that room only;
  - a TTL of 10 minutes.
- [ ] The token endpoint ignores every client-supplied field.
- [ ] S1 test: supertest against the real application module verifies the Room Token with `livekit-server-sdk`'s token verifier. It checks the identity, room grant, Agent dispatch and TTL, and that client fields are ignored.
- [ ] The Agent registers with `AGENT_NAME` and joins only rooms it is dispatched to.
- [ ] With the `fake` Provider, the Agent starts a session that needs no API keys and makes no network calls to AI Providers.
- [ ] The Agent logs the room name when a session starts and ends.
- [ ] The frontend is React and Vite with Tailwind and shadcn/ui. A dev proxy forwards `/api` to the backend.
- [ ] The Conversation page has Start and End. It uses the `@livekit/components-react` session hooks with a custom token source that calls `/api/token`.
- [ ] S4 test: Playwright drives Chromium with fake media flags and a WAV fixture as the microphone. It presses Start, sees the Agent participant join the room, and presses End. It runs through `test:e2e` against Docker Compose and the three apps.
- [ ] S4 passes on macOS with the LiveKit server in Docker. If media cannot flow through Docker, apply the spec's fallback (native `brew install livekit`, which changes only the Compose file and env) and record the finding under `## Comments` in this file.

Quality tooling (spec: Quality gates, layers 1 and 2):

- [ ] Prettier is configured once at the root. `pnpm format` writes and `pnpm format:check` checks.
- [ ] ESLint 9 uses one root flat config covering every package. It includes:
  - typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`;
  - `eslint-plugin-sonarjs`;
  - `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y` for the frontend;
  - the Vitest ESLint plugin for tests;
  - `eslint-config-prettier`;
  - a rule requiring a description on every ESLint disable comment;
  - `@typescript-eslint/ban-ts-comment`, so `@ts-ignore` is not allowed.
- [ ] `pnpm lint` runs ESLint with `--max-warnings 0`.
- [ ] Every package has `strict` TypeScript. `pnpm typecheck` runs `tsc --noEmit` in all of them.
- [ ] `pnpm test` collects coverage with the Vitest v8 provider and writes an `lcov` report per package.
- [ ] `pnpm check` runs format check, lint, typecheck and tests with coverage, and fails if any of them fails.
- [ ] A lefthook pre-commit hook runs Prettier and ESLint on staged files plus `pnpm typecheck`, and blocks the commit on failure.
- [ ] A project-level Claude Code `PostToolUse` hook on file edits runs Prettier and `eslint --fix` on the edited file. Any remaining ESLint errors are reported back to the agent.
- [ ] Definition of done: `pnpm check` passes with zero warnings. Fix the code itself; never add suppression comments or loosen rules (see `CODING_STANDARDS.md`).

## Comments

### 2026-11-14, implementer (branch `ticket/01-tracer-bullet`)

**WebRTC through Docker on macOS: media flows, but only over ICE/TCP.** S4 passes with LiveKit v1.13.11 in Docker Desktop 29 on macOS, so the brew fallback was not applied.

- LiveKit's logs show the browser and the Agent both select `tcp host 127.0.0.1:7881` paired with a peer-reflexive candidate from Docker Desktop's gateway (`192.168.65.1`).
- Experiment: a container that published only 7880 and 7882/udp. The browser failed with `ConnectionError: could not establish pc connection`, and S4 failed as it should. So UDP 7882 does not connect through Docker Desktop here; 7881/tcp carries all media.
- TCP media is fine for local development. It adds latency under packet loss, so it says nothing about production media quality.
- S4 asserts that microphone audio leaves the browser over WebRTC (`outbound-rtp` bytes > 0). The SFU forwards that track to the Agent, which subscribes to it.

**The `fake` Provider.** `voice.testing.FakeLLM` is public in `@livekit/agents` 1.10; no fake STT, TTS or RealtimeModel is exported. The `fake` Provider is an `AgentSession` with `FakeLLM` only, plus `vad: null` and `turnHandling: { turnDetection: null }`. Left unset, 1.10 creates a local Silero VAD (through `@livekit/local-inference`) and an `InferenceTurnDetector` that can call LiveKit Inference. With no STT and no VAD, adaptive interruption detection stays off. The Agent joins, reaches the `listening` state and doesn't speak. It ignores the browser's pre-connect audio buffer.

**Decisions and deviations for review:**

- ESLint is 9.39.x as the ticket says, but npm now marks ESLint 9 "no longer supported" (10.x is current). `eslint-plugin-jsx-a11y` 6.10 only supports up to ESLint 9.
- TypeScript is 6.0.x, because typescript-eslint 8.72 supports `<6.1.0` (TypeScript 7 is current).
- **Needs human approval (config change):** `@typescript-eslint/no-extraneous-class` uses `allowWithDecorator: true` for `backend/**` only. NestJS modules are empty classes that carry only `@Module`, so the code can't satisfy the rule's default. typescript-eslint documents this option for decorator frameworks.
- jsx-a11y uses its `strict` preset, not `recommended`.
- Vitest collects coverage only at the root of a projects config. `pnpm test` runs Vitest once, then `scripts/split-lcov-by-package.ts` splits `coverage/lcov.info` into `<package>/coverage/lcov.info`. Paths stay relative to the repo root.
- Coverage today is 43% of lines overall (backend 84%). The Agent and frontend have no fast tests until S2 and S3 arrive in tickets 03 and 04. Ticket 02's 80% gate on this code will need tests, since exclusions aren't allowed.
- The shared package exports its TypeScript source, with no build step. The backend builds with Nest's SWC builder, because a `tsc` build can't emit the shared source that sits outside its `rootDir`.
- The backend validates the token request body against the shared schema before ignoring it, so a wrongly typed field gets `400`.
- The Agent's `dev` script uses `node --watch-path=src`. Node's watch mode sets `WATCH_REPORT_DEPENDENCIES`, which the framework's forked inference and job processes inherited, breaking its IPC handshake ("first message must be InitializeResponse"). `main.ts` deletes the variable. The `@livekit/agents` `dev` command is deprecated in favor of `lk agent dev` and logs a warning; the `lk` CLI isn't installed here.
- After the User leaves, the Agent's session closes at once ("Conversation ended" is logged). LiveKit closes the room 20 seconds later (departure timeout), which ends the Agent job.
- Postgres is not in Docker Compose yet. Ticket 07 adds it.
- React Router and TanStack Query aren't added yet, because there is only one page.
- Git worktrees share `.git/hooks`, so `lefthook install` affects every checkout. In a checkout without `lefthook.yml`, lefthook exits 0 and doesn't block commits.
- S4 starts its servers on fixed ports (3000, 5173, 8081) and never reuses a running one. Stop `pnpm dev` first, and don't run two `test:e2e` at once.
