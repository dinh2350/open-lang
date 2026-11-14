# Spec: LiveKit Platform v1

Status: ready-for-agent

Vocabulary follows `GLOSSARY.md`. Decisions respect ADR 0001 (TypeScript everywhere), ADR 0002 (Postgres with Prisma) and ADR 0003 (self-managed accounts with JWT). Supporting facts with sources live in `docs/research/livekit-node-agents.md` and `docs/research/testing-strategy.md`.

## Problem Statement

We want people to talk out loud with an AI voice agent from their browser, and we have nothing yet: no repo structure, no media server, no agent, no accounts. We also need a way to compare voice approaches. A single realtime speech-to-speech model and a separate transcribe, think and speak pipeline behave differently, and so do OpenAI and Google. Without a working end-to-end skeleton we can't learn any of this. Without accounts and Roles, we can't control who uses the Agent or manage those people.

## Solution

A monorepo with four running parts:

- A browser app where a person registers or signs in, presses Start, and talks with the Agent.
- A backend that owns Users, Roles and sign-in, and issues the Room Token that lets a User join a Conversation.
- An Agent that joins each Conversation. A developer configures its Agent Mode (Realtime or Pipeline) and Providers (OpenAI or Google) without changing code.
- A self-hosted LiveKit server, run locally in Docker together with Postgres.

Admins manage Users from an admin page. Everything runs on a developer's machine. Production deployment comes later.

## User Stories

### Getting started (developer)

1. As a developer, I want one command to start the LiveKit server and Postgres, so that I don't have to install media or database servers by hand.
2. As a developer, I want one command to run the frontend, backend and Agent in dev mode with hot reload, so that I can iterate quickly.
3. As a developer, I want an example env file for each app that lists every variable with safe local defaults, so that I can get running without guessing configuration.
4. As a developer, I want secrets such as provider API keys and the JWT secret kept out of git, so that I can't commit them by accident.
5. As a developer, I want the Node and pnpm versions pinned, so that every machine builds the same way.
6. As a developer, I want one command that runs every fast test across all apps, so that I get feedback without provider keys or a running LiveKit server.
7. As a developer, I want a separate command for the end-to-end smoke test, so that I can check the whole system before merging.
8. As a developer, I want a separate command for live Agent tests against real Providers, so that I can check real model behavior when I choose to spend money on it.
9. As a developer, I want a seed command that creates the first Admin from environment variables, so that a fresh database has someone who can manage Users.

### Configuring the Agent (developer)

10. As a developer, I want to choose the Agent Mode (Realtime or Pipeline) with an environment variable, so that I can compare the two approaches without code changes.
11. As a developer, I want to choose the Provider for Realtime mode (OpenAI or Google) with an environment variable, so that I can compare vendors.
12. As a developer, I want to choose the Provider separately for each Pipeline step (speech-to-text, language model, text-to-speech), so that I can mix vendors.
13. As a developer, I want to set the model name for each step explicitly, so that I don't depend on plugin defaults that may be deprecated or in Preview.
14. As a developer, I want sensible default model names for each Provider, so that I only override what I need.
15. As a developer, I want the Agent to refuse to start, with a clear message, when the configuration is invalid (unknown mode or Provider, missing API key, a model on the deprecated list), so that I find mistakes at startup instead of mid-Conversation.
16. As a developer, I want to switch Google from a Gemini API key to Vertex AI through environment variables only, so that moving to company cloud credentials needs no code change.
17. As a developer, I want a `fake` Provider that needs no API keys, so that end-to-end tests can run without real AI calls.
18. As a developer, I want the Agent to log its Agent Mode, Providers and models when each Conversation starts, so that I know which setup I am listening to.

### Accounts and signing in (a person without an account, and Users)

19. As a person without an account, I want to register with my email and a password, so that I can start using the Agent.
20. As a person registering, I want to be signed in right after registering, so that I don't have to enter my details twice.
21. As a person registering, I want a clear message when my password is shorter than 12 characters or my email is already taken, so that I can fix it.
22. As a User, I want to sign in with my email and password, so that I can reach the Agent.
23. As a User who mistypes, I want one generic error that doesn't reveal whether the email or the password was wrong, so that attackers can't use the form to find accounts.
24. As a User, I want to stay signed in across page reloads for up to 7 days, so that I don't sign in every time.
25. As a User, I want to sign out and have my session revoked on the server, so that nobody can reuse it from this browser.
26. As a User, I want to be sent to the sign-in page when I open a protected page while signed out, so that I know what to do.
27. As a Locked User, I want a clear message that my account is locked when I sign in with the right password, so that I know to contact an Admin.
28. As the system owner, I want sign-in and registration limited to 5 attempts per minute per IP, so that password guessing is slow.

### Talking to the Agent (Member)

29. As a Member, I want to press Start to begin a Conversation, so that I can talk with the Agent.
30. As a Member, I want the browser to ask for microphone access when I press Start, so that the Agent can hear me.
31. As a Member, I want a clear message when microphone access is denied, so that I know how to fix it.
32. As a Member, I want the Agent to greet me first ("Hello, how can I help?"), so that I know it is connected and listening.
33. As a Member, I want to see whether the Agent is listening, thinking or speaking, so that I know when to talk.
34. As a Member, I want a visualizer that moves with the Agent's voice, so that the Conversation feels alive.
35. As a Member, I want to mute and unmute my microphone during a Conversation, so that the Agent doesn't hear side noise.
36. As a Member, I want to press End to finish the Conversation, so that the Agent stops listening.
37. As a Member, I want a reload during a Conversation to end it, and pressing Start to begin a new one, so that the behavior is predictable.
38. As a Member, I want a clear message when the Agent doesn't join within a reasonable time, so that I'm not left talking to silence.
39. As a Member, I want each Conversation to happen in its own private room, so that no one else can join or overhear it.
40. As a Member, I want the Agent to answer in English as a general-purpose assistant, so that I can ask it anything.

### Managing Users (Admin)

41. As an Admin, I want an admin page that only Admins can open, so that Members can't manage Users.
42. As an Admin, I want to see all Users with their email, Role, locked state and creation date, so that I know who has access.
43. As an Admin, I want to change a User's Role between Member and Admin, so that I can share admin duties.
44. As an Admin, I want to lock and unlock a User, so that I can block access without deleting the account.
45. As an Admin, I want locking a User to sign them out everywhere and block new Conversations right away, so that the lock takes effect immediately.
46. As an Admin, I want a Conversation that is already running to continue when I lock its User, so that locking never drops audio mid-sentence. Kicking them out is out of scope.
47. As an Admin, I want to set a new password for a User who forgot theirs, so that they can get back in without an email flow.
48. As an Admin, I want resetting a User's password to sign that User out everywhere, so that the old sessions stop working.
49. As an Admin, I want to be stopped from locking myself or changing my own Role, so that I can't lock myself out by mistake.
50. As an Admin, I want to be stopped from locking or demoting the last active Admin, so that the app always has someone who can manage Users.
51. As an Admin, I want to start Conversations too, so that I can use the Agent like any Member.

### Security of Room Tokens

52. As the system owner, I want only signed-in, unlocked Users to receive a Room Token, so that strangers can't use the Agent or the media server.
53. As the system owner, I want the backend to choose the room name, participant identity and Agent dispatch itself, ignoring whatever the browser sends, so that a client can't join someone else's room or call a different agent.
54. As the system owner, I want Room Tokens to expire after 10 minutes, so that a leaked token is useless soon after.

## Implementation Decisions

### Repository and runtime

- One pnpm workspace with five packages: frontend, backend, Agent, shared, and an end-to-end test package. All TypeScript (ADR 0001).
- Node 24 and pnpm 10, pinned through an nvm file and the `engines` and `packageManager` fields. The Agent runs its TypeScript directly with Node, as LiveKit's official Node starter does, with no build step.
- Docker Compose runs two services: the LiveKit server (`livekit/livekit-server`) and Postgres. The frontend, backend and Agent run on the host.
- Root scripts:
  - `dev`: all three apps.
  - `test`: every Vitest project, with coverage.
  - `test:e2e`: Playwright.
  - `test:live`: live Agent tests, skipped when keys are absent.
  - `db:migrate`, `db:seed`.
  - `format`, `format:check`, `lint`, `typecheck`, `check`.
  - `sonar:up`, `sonar:setup`, `sonar`.
- Each app has its own `.env` file, git-ignored, plus a committed example file.
- No CI and no git remote yet.

### Quality gates

AI-written code must pass deterministic scanners, and it is fixed until it does. Checks run in three layers, so mistakes are caught as early and as cheaply as possible.

**Layer 1: on every edit.** A project-level Claude Code `PostToolUse` hook runs Prettier and `eslint --fix` on each edited file and reports any remaining ESLint errors to the agent straight away.

**Layer 2: on every commit and ticket.** `pnpm check` runs Prettier in check mode, ESLint with zero warnings allowed, `tsc --noEmit`, and Vitest with coverage. A lefthook pre-commit hook runs Prettier, ESLint and typecheck on staged files. The ESLint setup is one root flat config with:
- typescript-eslint strict and stylistic type-checked configs;
- `eslint-plugin-sonarjs`, which runs most SonarQube JavaScript rules locally;
- React hooks and jsx-a11y rules;
- Vitest rules;
- Prettier compatibility.

**Layer 3: on every ticket.** SonarQube Community Build runs locally in Docker; there is no SonarQube server. Setting it up is scripted through its Web API. `pnpm sonar` scans with coverage, exits non-zero when the quality gate fails, and prints the failing conditions and issues. The gate, "LiveKit Platform Gate", applies to overall code:
- A ratings for reliability, security and maintainability;
- coverage of at least 80%;
- duplication of at most 3%;
- all Security Hotspots reviewed.

**No cheating the tools.** Agents fix the code, never the scanner:
- no ESLint disable comments without a description;
- no `@ts-ignore`;
- no `NOSONAR`;
- no loosening rules, exclusions or thresholds.

Changes to the lint, format, TypeScript or SonarQube configuration need human approval. Only a human may mark a Security Hotspot as safe. `CODING_STANDARDS.md` records these rules, plus the judgement-based standards that `/code-review` checks.

Every ticket's definition of done includes `pnpm check`, and from ticket 02 on also `pnpm sonar`.

### LiveKit server (local)

- Runs in dev mode, which uses the API key `devkey` and secret `secret` and a single UDP port.
- Bound to all interfaces, advertising `127.0.0.1` as its node IP. Ports 7880 (signal and API), 7881/tcp (ICE over TCP) and 7882/udp (WebRTC media) are published to the host.
- Browser and Agent both reach it at `ws://localhost:7880`.
- LiveKit does not officially support WebRTC through Docker on macOS (see the research doc). The first end-to-end slice must prove media flows. If it doesn't, the fallback is a native `brew install livekit`, which changes only the Compose file and env.
- No LiveKit Cloud features: no LiveKit Inference, no enhanced noise cancellation, no Agent Observability, no Simulations.

### Shared contract module

- The shared package holds zod schemas, and the TypeScript types inferred from them, for every backend request and response body. The frontend and backend both import them.
- The token endpoint follows LiveKit's standard token endpoint shape:
  - Request: a POST with optional snake_case fields (`room_name`, `participant_identity`, `participant_name`, `participant_metadata`, `participant_attributes`, `room_config`).
  - Response: `201` with `server_url` and `participant_token`.
  - The shared types are checked at compile time against `livekit-client`'s token source request and response payload types, so drift fails the build.

### Backend (NestJS 12, ESM)

- **Modules:** Auth, Users (admin management), LiveKit (Room Token issuing), Prisma (database access), Health.
- **Routing:** a global `/api` prefix, so paths match in dev (behind the Vite proxy) and later in production.
- **Validation:** request bodies are validated with the shared zod schemas through NestJS's Standard Schema validation pipe.
- **Data model (Prisma, Postgres):**
  - User: id, unique email, password hash (argon2), Role (Member or Admin), locked flag, timestamps.
  - Refresh token: id, User, token hash, expiry, revoked-at, the token it replaced. Used for rotation and reuse detection.
- **Auth API** (ADR 0003):
  - Register: email and password. Password at least 12 characters, no composition rules. Creates a Member, signs them in, and returns `201` with an Auth Token and the User.
  - Sign in: returns an Auth Token and the User, and sets the refresh cookie.
    - Wrong email or password: `401` with one generic message.
    - Locked User with the correct password: `403` with an "account locked" message.
  - Refresh: reads the refresh cookie, rotates it, and returns a new Auth Token.
    - Fails with `401` when the token is missing, expired or revoked, or the User is locked.
    - Reusing a refresh token that was already rotated revokes all of that User's refresh tokens.
  - Sign out: revokes the current refresh token, clears the cookie, returns `204`.
  - Current User: returns the signed-in User.
  - Register and sign in are rate limited with `@nestjs/throttler` to 5 requests per minute per IP.
- **Auth Token:** an HS256 JWT signed with `JWT_SECRET`. It expires after 15 minutes and carries the User id and Role. The frontend keeps it in memory only.
- **Refresh token:** an opaque random value. It expires after 7 days and travels in an httpOnly, `SameSite=Strict` cookie scoped to the auth routes. It is stored hashed.
- **Guards:** built with `@nestjs/jwt`; we are not using the 0.x `@nestjs/authentication` and `@nestjs/authorization` packages.
  - An authentication guard verifies the Auth Token, then loads the User from the database on every request. A Locked User gets `403`, and the current Role always comes from the database. So locking and Role changes take effect on the next request, whatever the token says.
  - A Role guard restricts admin routes to Admins.
- **Admin API (Admin only):**
  - List Users.
  - Change a User's Role.
  - Lock and unlock a User. Locking revokes all of their refresh tokens.
  - Set a new password for a User. This revokes all of their refresh tokens.
  - An Admin may not lock themselves or change their own Role.
  - Nobody may lock or demote the last unlocked Admin.
  - Breaking either rule returns `409`.
- **Room Token endpoint (any signed-in, unlocked User):**
  - Accepts the standard request shape but ignores every client-supplied field.
  - The backend creates a new random room name for each request (one room per Conversation).
  - It sets the participant identity to the User id.
  - It embeds an explicit dispatch of the Agent by name (`AGENT_NAME`, shared with the Agent) in the token's room configuration.
  - It grants join, publish and subscribe for that room only, with a TTL of 10 minutes.
  - It returns `201` with the LiveKit server URL and the token.
  - Dispatch through the token works only when the room is first created, which always holds because every room name is new.
- **Seed:** a command creates the first Admin from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` if no Admin exists. It does nothing when one exists.
- **Logging:** structured stdout logs. Issuing a Room Token logs the User id and room name. Nothing about Conversations is persisted.

### Agent (`@livekit/agents` 1.10.x for Node)

- **Startup:** an agent server registered with an explicit `AGENT_NAME`, so it only joins rooms it is dispatched to. Connection settings: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- **Config module.** This is the Agent's main seam: a pure function from environment to a validated Agent configuration, plus a factory that turns that configuration into session options (models, VAD, turn detection).
  - `AGENT_MODE`: `realtime` or `pipeline`.
  - Realtime mode: `REALTIME_PROVIDER` (`openai`, `google`, or `fake`) and `REALTIME_MODEL`.
  - Pipeline mode: `STT_PROVIDER` with `STT_MODEL`, `LLM_PROVIDER` with `LLM_MODEL`, and `TTS_PROVIDER` with `TTS_MODEL`. Each Provider is `openai`, `google` or `fake`, and the Providers may be mixed.
  - Optional voice settings per Provider.
  - The config module holds the default model for each Provider and step. Pick models that are generally available on the day this is implemented, not the plugin defaults: several plugin defaults are deprecated or in Preview, and the Gemini TTS default shuts down on 2026-12-18.
  - A small list of known-deprecated models; validation rejects any configured model on it.
  - Validation fails at startup with a message naming the bad variable: unknown values, a missing API key for a selected Provider, or a deprecated model.
- **Provider mapping:**
  - OpenAI uses the OpenAI plugin's realtime model, LLM, STT and TTS, with `OPENAI_API_KEY`.
  - Google uses the Google plugin: realtime `google.realtime.RealtimeModel`, LLM `google.LLM`, STT `google.beta.GeminiSTT`, TTS `google.beta.TTS`. The STT and TTS classes are beta. Credentials come from `GOOGLE_API_KEY`, or Vertex AI through `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`.
  - Azure OpenAI is not configured.
- **Pipeline mode** adds Silero VAD and the local `v1-mini` turn detector, which runs on CPU and needs no LiveKit Inference.
- **`fake` Provider:** uses the framework's test fakes (such as `FakeLLM`) so the Agent can join a Conversation and run its session without network calls or keys. Its only job is to let the end-to-end smoke test pass without keys. Its exact shape depends on what `voice.testing` exposes; real speech output is not required.
- **Behavior:** a general-purpose English assistant with a short system prompt and no tools. After joining, it greets the User first with "Hello, how can I help?". The session ends when the User leaves the room.
- **Logging:** logs the Agent Mode, Providers and models at session start, and the room name at session start and end.

### Frontend (React + Vite)

- Tailwind and shadcn/ui. LiveKit Agents UI shadcn components may be used for the visualizer and controls. React Router for routes, TanStack Query for backend calls.
- In dev, the Vite proxy forwards `/api` to the backend, so the browser sees a single origin. No CORS configuration is needed, and the strict same-site cookie works.
- **Session handling:**
  - On load the app calls refresh to get an Auth Token, which it keeps in memory.
  - API calls attach the token, and on `401` the app tries one refresh and then sends the User to sign-in.
  - On `403` locked, it shows the locked message.
- **Routes:**
  - Sign-in and register pages.
  - Conversation page at the root. Needs a signed-in User.
  - Admin Users page. Admins only; Members who open it are redirected.
- **Conversation page:**
  - Uses `@livekit/components-react` session hooks with a custom token source. That source calls the Room Token endpoint with the Auth Token and maps the snake_case response.
  - Shows Start/End, mic mute, the Agent's state (listening, thinking, speaking) and an audio visualizer.
  - Handles three errors: microphone denied, Room Token failure, and the Agent not joining within a timeout.
  - No transcript.
- **Admin Users page:**
  - A table with email, Role, locked state and created date.
  - Actions to change Role, lock or unlock, and set a new password.
  - `409` errors from the last-Admin and self rules are shown inline.

## Testing Decisions

### What makes a good test

- A good test exercises external behavior through the highest seam available and asserts on what a caller observes: HTTP status and body, token claims, rendered UI, a participant appearing in a room. It never asserts on private functions, internal call order, or framework wiring.
- Tests use the glossary vocabulary in their names.
- Tests are deterministic and need no provider keys, except in the explicit live tier.
- Write the tests first (red, green, refactor) one vertical slice at a time.

### The four agreed seams

**S1: Backend HTTP API.**
- Supertest against the real NestJS application module, on a real Postgres started by Testcontainers. Each Vitest worker gets its own database, migrated once in global setup, and tables are truncated before each test.
- Auth is exercised through the real register and sign-in flow, or with Auth Tokens signed by the test `JWT_SECRET`. Guards are not mocked.
- Covers:
  - Registration and sign-in rules, generic errors, the Locked User response and rate limits.
  - Refresh rotation and reuse detection, sign-out revocation.
  - Role guarding and every admin action, including the self and last-Admin `409` rules.
  - The Room Token endpoint.
- Room Tokens are checked with `livekit-server-sdk`'s token verifier:
  - identity equals the User id;
  - the room grant matches the returned room;
  - the room configuration dispatches `AGENT_NAME`;
  - the TTL is 10 minutes;
  - client-supplied fields are ignored.
- No separate unit tests for services or controllers, unless a pure function is complex enough to need its own.

**S2: Agent configuration and session.**
- The config module is tested directly:
  - The full matrix of Agent Mode by Provider, including mixed pipeline Providers, built with dummy API keys. It asserts which plugin classes were built, using `instanceof`. Constructors don't connect, so no network is used.
  - Every validation failure: unknown mode or Provider, missing key, deprecated model.
- Agent behavior is tested through `voice.testing`: a session runs with `FakeLLM` and its result is asserted, for example that the Agent greets first. To make that possible, the Agent receives its models as parameters.
- The same seam runs with real models in the live tier, `test:live`. That tier uses `judge()` for each Provider, needs keys, and is skipped without them. Realtime mode has no public fake, so it is covered only in the live tier.

**S3: Frontend routes.**
- Vitest with jsdom and Testing Library. The whole app is rendered at a given route, with MSW handling the `/api` endpoints, and a real `livekit-client` Room that never connects (LiveKit's own test pattern).
- Covers:
  - Sign-in and register flows and errors.
  - The redirect when signed out.
  - The locked message.
  - Members can't see or open the admin page.
  - Admin actions and inline `409` errors.
  - Conversation page states and errors: Start, End, mute, mic denied, token failure, Agent timeout.

**S4: Whole system.**
- Playwright with Chromium using fake media flags, playing a WAV fixture as the microphone, against Docker Compose (LiveKit, Postgres) and the three apps. The Agent uses the `fake` Provider.
- Smoke test: register, press Start, the Agent participant joins the room and its state shows, press End.
- This is also the check that WebRTC works through Docker on macOS. It runs before merging, through `test:e2e`.
- A fuller voice test with real Providers is manual or nightly, and not required for v1.

### Contract

- The shared zod schemas are checked at compile time against the LiveKit client token payload types. No runtime test seam is needed.

### Prior art

- There is no code in this repo yet.
- Follow:
  - NestJS 12's ESM scaffold, which uses Vitest.
  - The NestJS testing docs.
  - LiveKit's `voice.testing` docs and the plugin test files in `agents-js`.
  - LiveKit's `components-js` tests for the unconnected-Room pattern.
- `docs/research/testing-strategy.md` lists sources and config shapes, including the root Vitest projects config and the Playwright fake-media launch flags.

## Out of Scope

- Single sign-on or any external identity provider (ADR 0003 explains how it would be added later).
- Email verification, password reset by email, and any email sending.
- Storing Conversations, transcripts or history, and a transcript UI.
- Removing a Locked User from a Conversation that is already running.
- Choosing the Agent Mode or Providers per Conversation, or from the UI or admin page. It is environment configuration only.
- Agent tools or function calling, multiple Agents, multi-tenancy, languages other than English.
- Telephony (SIP), video, screen share, mobile apps.
- Azure OpenAI and other Providers beyond OpenAI and Google.
- LiveKit Cloud features: LiveKit Inference, the `v1` turn detector, enhanced noise cancellation, Agent Observability, Simulations.
- Production deployment, a hosting decision for the LiveKit server, CI pipelines, a git remote.
- Account deletion, User profile fields beyond email, display names.

## Further Notes

- **Build order:** the first slice is a tracer bullet. Docker Compose with LiveKit, an anonymous Room Token endpoint, the Agent with a single Provider, and a bare Conversation page, proven by the S4 smoke test. It retires the biggest risk (WebRTC through Docker on macOS) before any auth work. A later slice puts the Room Token endpoint behind sign-in. The token contract doesn't change; only the source of the identity changes, from random to the User id.
- **Model lifecycle:** Provider model names change quickly. The Gemini TTS Preview default shuts down on 2026-12-18, and the Gemini Live API default is a Preview limited to existing users. Confirm the default models against Provider docs when implementing, and keep the deprecated-model list current.
- **Node gaps:** some LiveKit Google features are Python only. For example, Google Cloud STT and TTS aren't available in Node, so Node uses the Gemini STT and TTS classes instead. Check Node support before adding any agent feature (ADR 0001).
- **Open questions from the testing research:**
  - Whether NestJS 12 works with Vitest 5; its template pins Vitest 4.
  - Whether Vite 8's decorator-metadata handling breaks any NestJS pattern used here. If it does, fall back to the `unplugin-swc` setup from the NestJS docs.
- **Quality gates:** linting, formatting and static analysis were added after the first breakdown; see Implementation Decisions, Quality gates. SonarQube Community Build has no branch analysis or pull request decoration. If the team later gets a SonarQube server or SonarQube Cloud, switch the gate to new-code conditions and run it in CI.

## Comments

### 2026-11-14, implement-spec run

All ten tickets are implemented and merged into `feat/livekit-platform-v1`. Code review ran on two axes, Standards and Spec.

**Fixed and merged.** These findings were fixed on `fix/code-review` and merged:
- Spec 1: no LiveKit Inference for interruption detection.
- Spec 6: S2 asserts through public behavior.
- Spec 7: the Agent join timeout is set by env.
- Spec 8: the `fake` Provider rejects deprecated models.
- Spec 9: a refresh that races a lock returns `401`.
- Rate limits count per browser behind the dev proxy.
- The Provider smells are refactored.
- Backend and Agent duplication is removed.
- Comments use glossary terms.

**Checks.** On the merged result, `pnpm check` (430 tests), `pnpm sonar` (gate passed) and `test:e2e` (2 passed) all pass.

**Stopped by the human.** The human stopped the rest of the review fixes. The remaining findings are follow-up tickets 11 to 16. Earlier follow-ups are tickets 17 to 20. Decisions waiting for a human are tickets 21 and 22.

**Still waiting for human approval**, as `CODING_STANDARDS.md` requires (see each ticket's `## Comments`):
- Ticket 01: the ESLint `no-extraneous-class` rule with `allowWithDecorator` for the backend.
- Ticket 02: the Sonar analysis scope and exclusions, the admin `SONAR_TOKEN`, the committed local Sonar admin password, and the MQR gate conditions.
- Ticket 06: Google models rejected on both APIs although they are deprecated on only one.
- Ticket 07: ESLint ignores `**/generated/`, and the pnpm build-script allowlist.
- Ticket 09: the seed refuses an email that already belongs to a Member.
- Ticket 05 and ticket 06: `reasoningEffort: none` and low Gemini thinking.

**Never run.** The live tier (`test:live`) and the manual voice checks have not run, because no Provider keys are available.
