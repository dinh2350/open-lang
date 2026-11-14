# Testing strategy research

Researched 2026-11-14 against primary sources only. Versions on npm that day: `@livekit/agents` 1.10.0, `livekit-server-sdk` 2.19.3, `livekit-client` 2.24.1, `@livekit/components-react` 2.9.25, `@nestjs/*` 12.5.0, `@nestjs/authentication` 0.1.6, `@nestjs/authorization` 0.1.4, `vitest` 5.1.0, `vite` 8.3.8, `@playwright/test` 1.65.1, `@testcontainers/postgresql` 12.2.1, `zod` 4.6.7. GitHub links are pinned to the commit that was read.

## 1. Test runner

- NestJS 12 changed the default. `nest new` asks for a module system: ESM (the default) gets Vitest, CommonJS gets Jest. `@nestjs/testing` does not depend on a runner. Jest can load the ESM-only v12 packages only on Node 24.9 or later. [cli/overview](https://docs.nestjs.com/cli/overview), [migration-guide](https://docs.nestjs.com/migration-guide)
- The official ESM scaffold runs Vitest 4 on Vite 8 with **no SWC plugin**, and its tsconfig sets `emitDecoratorMetadata`. [schematics ts-esm](https://github.com/nestjs/schematics/tree/a4c11ce945fe02c441fafec101d9c39ae5e4a7c3/src/lib/application/files/ts-esm)
- Vite 8 transpiles with Oxc and supports `emitDecoratorMetadata` only partly. [vite features](https://vite.dev/guide/features#emitdecoratormetadata) Oxc emits imported classes as runtime references, but any type it would have to infer becomes `Object`. [oxc decorators](https://oxc.rs/docs/guide/usage/transformer/typescript.html#decorators)
- Fallback: the NestJS SWC recipe adds `unplugin-swc` (`swc.vite({ module: { type: 'es6' } })`). E2E tests need `import request from 'supertest'`. [recipes/swc#vitest](https://docs.nestjs.com/recipes/swc#vitest)
- Monorepo: use `test.projects`. The old `workspace` option has been deprecated since Vitest 3.2. Since Vitest 5.0, inline projects inherit the root config by default. `--project` filters which projects run, and every project name must be unique. [vitest projects](https://vitest.dev/guide/projects)
- LiveKit uses Vitest for agent tests [unit-tests](https://docs.livekit.io/testing/unit-tests.md) and for `components-react` with jsdom. [vite.config.js](https://github.com/livekit/components-js/blob/8ac079b46ead3ec8f5698389667bc614eb1aea12/packages/react/vite.config.js#L76-L79)

## 2. Backend `POST /token`

- Build the app with `Test.createTestingModule({ imports: [AppModule] })` and send requests with `request(app.getHttpServer())`. Swap dependencies with `overrideProvider()`. [fundamentals/testing](https://docs.nestjs.com/fundamentals/testing)
- To dispatch an agent from the token, set `at.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName, metadata })] })`. Dispatch happens only when the room is first created, so use a unique room name per session. [agent-dispatch](https://docs.livekit.io/agents/server/agent-dispatch.md) `livekit-server-sdk` re-exports both classes. [index.ts](https://github.com/livekit/node-sdks/blob/524e21d9352fc89fd210af71e1396750b8706164/packages/livekit-server-sdk/src/index.ts#L50-L82)
- `new TokenVerifier(key, secret).verify(jwt)` checks the HS256 signature, the issuer, and that `exp` is present. It returns `ClaimGrants`: `sub`, `video.room`, `video.roomJoin`, `roomConfig.agents[]`. `toJwt()` throws if `roomJoin` is set without an identity. [AccessToken.ts](https://github.com/livekit/node-sdks/blob/524e21d9352fc89fd210af71e1396750b8706164/packages/livekit-server-sdk/src/AccessToken.ts#L197-L247) The SDK's own test asserts `decoded.roomConfig?.agents?.[0]?.agentName`. [AccessToken.test.ts](https://github.com/livekit/node-sdks/blob/524e21d9352fc89fd210af71e1396750b8706164/packages/livekit-server-sdk/src/AccessToken.test.ts#L115-L163) None of this needs a LiveKit server.
- LiveKit defines a standard token endpoint. The request is snake_case JSON (`room_name`, `participant_identity`, `room_config`, ...). The response is `201` with `server_url` and `participant_token`. Return 4xx for fields clients may not set. [endpoint](https://docs.livekit.io/frontends/build/authentication/endpoint.md) `TokenSource.endpoint` POSTs this shape by default. [TokenSource.ts](https://github.com/livekit/client-sdk-js/blob/15ca1f39f0eded2b4ce2f525a7dcbcf6e7e3b9c7/src/room/token-source/TokenSource.ts#L146-L222)

## 3. Agent

- **The Node SDK has a testing API.** `voice.testing` exports `RunResult`, `RunAssert`, `withMockTools`, and `FakeLLM`. [testing/index.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/agents/src/voice/testing/index.ts) `session.run({ userInput })` runs a turn "without requiring a real room connection". [agent_session.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/agents/src/voice/agent_session.ts#L1487-L1550) `MessageAssert.judge(llm, { intent })` is the LLM judge.
- Docs page: [testing/unit-tests](https://docs.livekit.io/testing/unit-tests.md) (Node examples use Vitest). It says testing "doesn't make a LiveKit room connection" but runs "live against your LLM provider". `JudgeGroup`, the built-in judges, and session-scoped mocks are Python-only.
- **Offline determinism:** `voice.testing.FakeLLM` maps an exact input string to canned text and/or tool calls. It ships in the 1.10.0 build, and LiveKit's examples use it for "deterministic, offline tests". [basic_task_group.test.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/examples/src/testing/basic_task_group.test.ts) The docs page does not mention it.
- **Gotcha:** an LLM set on the `Agent` overrides the one set on the session. [agent_activity.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/agents/src/voice/agent_activity.ts#L1293-L1295) The starter puts `llm` on the Agent. [agent.ts](https://github.com/livekit-examples/agent-starter-node/blob/c05b8564c59e1e546b65f9d06496ca12daee7a09/src/agent.ts) So inject models as parameters.
- No fake `RealtimeModel` is exported; LiveKit defines one privately. [realtime_turn_detection.test.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/agents/src/voice/realtime_turn_detection.test.ts#L25)
- The starter comments out its eval and relies on `lk agent simulate` on LiveKit Cloud at merges to main. [simulations.yml](https://github.com/livekit-examples/agent-starter-node/blob/c05b8564c59e1e546b65f9d06496ca12daee7a09/.github/workflows/simulations.yml)
- `lk agent debugger say --json` drives one text turn at a time and prints tool calls. Text mode uses no room and "needs no project credentials", but the agent still calls its own LLM. [debugger](https://docs.livekit.io/testing/debugger.md)

## 4. Frontend

- LiveKit-documented test helpers for React: **not found**.
- LiveKit's own `components-react` tests use Vitest with jsdom and Testing Library. They create a real `new Room()` that never connects and set `room.state = ConnectionState.Connected`. They call `vi.spyOn` on `prepareConnection` and `disconnect`, emit `ParticipantEvent`s, and pass `TokenSource.literal({...})` to `useSession(tokenSource, { room })`. [useSession.test.ts](https://github.com/livekit/components-js/blob/8ac079b46ead3ec8f5698389667bc614eb1aea12/packages/react/src/hooks/useSession.test.ts) They stub sibling hooks with `vi.mock`. [useAgentExpression.test.ts](https://github.com/livekit/components-js/blob/8ac079b46ead3ec8f5698389667bc614eb1aea12/packages/react/src/hooks/useAgentExpression.test.ts)
- `SessionProvider` only provides `SessionContext` and `RoomContext`, so a test can wrap components with it. [SessionProvider.tsx](https://github.com/livekit/components-js/blob/8ac079b46ead3ec8f5698389667bc614eb1aea12/packages/react/src/components/SessionProvider.tsx)

## 5. End-to-end

- `livekit-server --dev` uses `devkey`/`secret` and binds to `127.0.0.1:7880`. [local](https://docs.livekit.io/transport/self-hosting/local.md)
- Chromium flags: `--use-fake-ui-for-media-stream` skips the permission prompt, and `--use-fake-device-for-media-stream` replaces real devices. [webrtc testing](https://webrtc.github.io/webrtc-org/testing/) `--use-file-for-fake-audio-capture=<file.wav>` plays a WAV as the microphone. Add the `%noloop` suffix to play it once. It must be combined with the fake-device flag, and audio processing should be disabled. [media_switches.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/base/media_switches.cc)
- Playwright passes browser args through `use.launchOptions` [use options](https://playwright.dev/docs/test-use-options#more-browser-and-context-options). It accepts an array of `webServer` entries. [webserver](https://playwright.dev/docs/test-webserver#multiple-web-servers)
- LiveKit's E2E story for agents is **Agent Simulations** (text or audio). They require a LiveKit Cloud project. The docs suggest text runs per commit and audio runs nightly. [simulations](https://docs.livekit.io/testing/simulations.md) Agent observability also requires LiveKit Cloud and "doesn't work with self-hosted media servers". [observability](https://docs.livekit.io/testing/observability.md) The SDK can still export OpenTelemetry traces from Node to any backend you run. [tracing](https://docs.livekit.io/testing/observability/tracing.md)
- A Playwright guide against `livekit-server --dev`: **not found**. LiveKit's client SDK CI runs Vitest browser mode with Playwright Chromium against a `livekit/test-server` Docker service. [e2e.yaml](https://github.com/livekit/client-sdk-js/blob/15ca1f39f0eded2b4ce2f525a7dcbcf6e7e3b9c7/.github/workflows/e2e.yaml), [vitest.e2e.config.mts](https://github.com/livekit/client-sdk-js/blob/15ca1f39f0eded2b4ce2f525a7dcbcf6e7e3b9c7/vitest.e2e.config.mts)

## 6. Contract between apps

- NestJS 12 ships `StandardSchemaValidationPipe` (present in `@nestjs/common` 12.5.0). It validates Zod, Valibot, or ArkType schemas attached with `@Body({ schema })`. "The schema is the single source of truth." Invalid input returns 400 with path-prefixed messages, and `z.object()` strips unknown keys. It can run alongside `ValidationPipe` with class-validator. [application/validation](https://docs.nestjs.com/application/validation)
- `livekit-client` exports `TokenSourceRequestPayload` and `TokenSourceResponsePayload`, the snake_case wire types. [types.ts](https://github.com/livekit/client-sdk-js/blob/15ca1f39f0eded2b4ce2f525a7dcbcf6e7e3b9c7/src/room/token-source/types.ts#L21-L28)

## 7. NestJS + Postgres

- The NestJS docs mock the database with `getDrizzleToken()` for unit tests. For anything beyond simple queries, they say to move queries into repositories or "run these tests against a real database". [data/drizzle](https://docs.nestjs.com/data/drizzle)
- NestJS's own auth E2E tests run on **PGlite** (Postgres compiled to WASM, real migrations, no server). Because PGlite has a single connection, its concurrency tests also run on real PostgreSQL in a throwaway database, with `TRUNCATE` before each case. [security/authentication](https://docs.nestjs.com/security/authentication)
- Testcontainers provides `PostgreSqlContainer`, `getConnectionUri()`, and `snapshot()`/`restoreSnapshot()` (not with a database named `postgres`). [postgresql module](https://node.testcontainers.org/modules/postgresql/) It plugs into Vitest through `globalSetup`, `project.provide` and `inject`. The docs warn that one shared container "limits your tests to run sequentially". [global-setup](https://node.testcontainers.org/quickstart/global-setup/) `DockerComposeEnvironment` can also drive a compose file. [compose](https://node.testcontainers.org/features/compose/)
- Vitest: `VITEST_POOL_ID` tells workers apart. Since Vitest 5 it is 1-based, and the docs name "a per-worker database name" as a use. [setupfiles](https://vitest.dev/config/setupfiles), [migration](https://vitest.dev/guide/migration)
- A first-party comparison of Testcontainers with a docker-compose database, or advice on per-test transaction rollback: **not found**.

## 8. NestJS auth

- `overrideGuard()` replaces a guard. A global `APP_GUARD` can be overridden only if it is registered with `useExisting`, followed by `overrideProvider(JwtAuthGuard).useClass(MockAuthGuard)`. [fundamentals/testing](https://docs.nestjs.com/fundamentals/testing#overriding-globally-registered-enhancers) A `RolesGuard` reads role metadata through `Reflector`. [guards](https://docs.nestjs.com/guards)
- The new `@nestjs/authentication` (0.x) package's `JwtBearerProvider` accepts tokens from an external issuer. Configure it with a `jwks` URL (https, or plain http on localhost) or a public `key`, plus the required `issuer` and `audience`. Its tests override `PasswordHasher` and can mint credentials with `TokenService.issue()` or `SessionService.create()`. [security/authentication](https://docs.nestjs.com/security/authentication)
- In `@nestjs/authorization`, policies are plain classes and can be unit-tested without Nest. Service tests use `AuthorizationModule.forRoot()`. Over HTTP, an E2E test should get 401 for a missing user and 403 for a denied one. [security/authorization](https://docs.nestjs.com/security/authorization)

## 9. Agent provider matrix

- Classes: `openai.realtime.RealtimeModel` (plus `.withAzure`), `openai.STT`, `openai.LLM`, `openai.TTS` [openai index](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/plugins/openai/src/index.ts). For Gemini: `google.realtime.RealtimeModel`, `google.LLM`, `google.beta.GeminiSTT`, `google.beta.TTS`. [google index](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/plugins/google/src/index.ts)
- Constructors check that a key is present but do not connect. The OpenAI realtime model throws without `OPENAI_API_KEY` (unless Azure options are set) and opens its socket later. [realtime_model.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/agents/src/llm/openai_realtime/realtime_model.ts) `google.LLM` throws without `GOOGLE_API_KEY`. [llm.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/plugins/google/src/llm.ts#L242-L258) LiveKit's plugin tests construct models with `apiKey: 'test-key'` [google realtime test](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/plugins/google/src/realtime/realtime_session_options.test.ts#L57) and gate live suites on the presence of the env key. [ws/llm.test.ts](https://github.com/livekit/agents-js/blob/1fa759cf67477f19466a68cb15e2e17de1908e04/plugins/openai/src/ws/llm.test.ts#L21)

## Recommended setup

Legend: **[S]** follows directly from a source above. **[J]** is my judgement.

| Layer | Tool | Covers | LiveKit server? | AI keys? | CI |
|---|---|---|---|---|---|
| Contract | Vitest | shared zod schemas, compile-time check against `livekit-client` payload types [J] | No | No | every push |
| Backend unit | Vitest + `@nestjs/testing` | token claims via `TokenVerifier` [S], policies [S], guards | No | No | every push |
| Backend E2E | Vitest + supertest + PGlite, plus Testcontainers for race tests [S] | `POST /token`, 401/403, DB | No | No | every push (Docker for Testcontainers) |
| Agent config | Vitest | 2 modes x 2 providers, `instanceof` with dummy keys [J] | No | No | every push |
| Agent behavior, offline | `voice.testing` + `FakeLLM` + `withMockTools` [S] | tools, turn flow | No | No | every push |
| Agent behavior, live | `session.run` + `judge`, `lk agent debugger` [S] | real model behavior per provider | No | Yes | nightly or manual |
| Frontend unit | Vitest jsdom + Testing Library, unconnected `Room` [S] | UI states | No | No | every push |
| E2E smoke | Playwright + fake media + `livekit-server --dev` [J] | token, connect, agent joins | Yes (Docker) | No, if the agent has a fake-model mode [J] | every PR |
| E2E voice / simulations | Playwright with WAV [J]; `lk agent simulate` [S] | full audio path | dev server or LiveKit Cloud | Yes | nightly |

Judgement calls [J]:

- One runner (Vitest) everywhere; zod plus `StandardSchemaValidationPipe` for the shared contract.
- Build agents with `createAgent(models)` so tests can inject `FakeLLM`. Realtime mode has no public fake, so cover its tools and instructions through the pipeline path and test realtime only in the live tier.
- Database: one Postgres database per worker (`app_test_${VITEST_POOL_ID}`), migrated once in `globalSetup`, with `TRUNCATE` in `beforeEach`.
- Auth E2E: sign test JWTs with a locally generated key that the app trusts through `key`. Use `overrideGuard` only in controller tests that do not care about auth.

```ts
// vitest.config.ts (root) [S: projects guide]
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { projects: ['*/vitest.config.ts', 'backend/vitest.e2e.config.ts'] },
});
```

```ts
// backend/vitest.config.ts [S: NestJS ESM scaffold; SWC fallback from recipes/swc]
import { defineProject } from 'vitest/config';
// import swc from 'unplugin-swc'; // fallback if metadata gaps appear
export default defineProject({
  resolve: { tsconfigPaths: true },
  test: { name: 'backend', globals: true, include: ['src/**/*.spec.ts'] },
  // plugins: [swc.vite({ module: { type: 'es6' } })],
});
```

```ts
// e2e/playwright.config.ts [S: flags from Chromium; J: wiring]
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-audio-capture=e2e/fixtures/hello.wav%noloop',
      ],
    },
  },
  webServer: [
    { command: 'pnpm --filter backend dev', url: 'http://localhost:3000/health' },
    { command: 'pnpm --filter frontend dev', url: 'http://localhost:5173' },
  ],
});
```

## Open questions / not found

- NestJS support for Vitest 5 (the scaffold pins `vitest ^4.1.2`): not found.
- Whether Oxc's partial `emitDecoratorMetadata` breaks any NestJS pattern here: needs a spike.
- `livekit/test-server` for app-level E2E: undocumented.
- Whether `new RoomConfiguration(body.room_config)` in LiveKit's endpoint example accepts snake_case keys: not confirmed, so add a test for it.
- A public fake `RealtimeModel`: not found.
- Maturity of `@nestjs/authentication` 0.x: not assessed.
