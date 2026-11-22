# Backend NestJS Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `backend/` in line with NestJS's documented structure without changing its API or behaviour: `UsersModule` owns the User table, `@nestjs/config` validates the environment once, the API prefix is declared once, and `auth/` is split by role.

**Architecture:** Behaviour-preserving refactor, one concern per task, ordered so the whole backend suite stays green after every task. A static `structure.spec.ts` grows one assertion per task and pins each goal so it cannot regress. The module graph stays acyclic by moving `RefreshTokenService` into its own `RefreshTokensModule`.

**Tech Stack:** NestJS 12, `@nestjs/config` 12.1.1 (new), zod 4 (Standard Schema), Prisma 7, Vitest with Testcontainers Postgres, Playwright.

**Spec:** [docs/superpowers/specs/2026-11-22-backend-nestjs-alignment-design.html](../specs/2026-11-22-backend-nestjs-alignment-design.html)

## Refinements to the approved design

Four things the design left open or got slightly wrong. They are consequences of reading `@nestjs/config` 12.1.1 and the existing tests, not changes of intent.

1. **`AppModule.register()` replaces a static `ConfigModule.forRoot` in the decorator.** In 12.1.1 `forRoot` is `async` and copies `process.env` the moment it is called. In a `@Module` decorator that is import time, before `vi.stubEnv`. The design's fallback (dynamic `import()` per test) would split class identities, because tests import `UsersService` statically. So `AppModule.register(): Promise<DynamicModule>` calls `forRoot` when invoked; `main.ts` and `startTestApp` call it.
2. **`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` stay optional at bootstrap** and are validated lazily inside `seedFirstAdmin`, as today. `.env.example` promises the seed "needs neither variable" once an Admin exists, so requiring them in `SeedModule`'s schema would change behaviour. The seed tests keep the `Invalid seed settings` message and only swap `PrismaService` for `UsersService`.
3. **`RefreshTokenService` is the one allowed exception** to "only `UsersService` touches the User table": its `include: { user: true }` and the `FOR SHARE` lock on the User row are the refresh/lock protocol described in its comments, and cannot move.
4. **Order:** the design said 3, 4, 1, 2. De-globalising `PrismaModule` moves to Task 4, after Task 3, so each module imports it once, and not twice.

## Global Constraints

- API paths, status codes, route error messages, database schema and migrations do not change.
- Nothing changes in `agent/`, `frontend/` or `shared/`; `parseEnv` stays in `shared`.
- No `@nestjs/terminus`, `@nestjs/passport` or `@Roles()`; `@AdminOnly()` and the hand-written guards stay.
- No module cycle and no `forwardRef`. `RefreshTokensModule` imports nothing from `auth/` or `users/`; `UsersModule` does not import `AuthModule`.
- Refresh cookie stays `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`, 7 days.
- Environment: `PORT` is a positive integer defaulting to 3000; `DATABASE_URL` is a `postgres`/`postgresql` URL; `JWT_SECRET` has at least 32 characters; LiveKit variables come from `liveKitEnvSchema` in `shared`. `ConfigModule` uses `ignoreEnvFile: true` and `isGlobal: true`.
- `pnpm db:seed` needs only `DATABASE_URL`, plus `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` when no Admin exists. It must not need `JWT_SECRET` or LiveKit variables.
- No `NOSONAR`, `@ts-ignore`, lint or Sonar exclusions, and no lowered thresholds (CLAUDE.md).
- Backend tests need Docker (Testcontainers). Use `git mv` for moves so history follows.

## Test Strategy

| Scenario                                                                                                                                                             | Unit                                            | Integration                                                           | E2E                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| Backend behaves as before: register, sign in, refresh, sign out, lock, role change, set password, room token, rate limit                                             | `structure.spec.ts` boundary checks (Tasks 1–6) | every existing `backend/test/*.spec.ts`, run in each task (Tasks 1–6) | `conversation.spec.ts` (Task 7)                           |
| Missing or invalid environment: the backend refuses to start and names the variable (`JWT_SECRET`, `DATABASE_URL`, LiveKit variables, `PORT`; short secret; bad URL) | `env-schema.spec.ts` (Task 5)                   | `startup.spec.ts` (Task 5)                                            | —                                                         |
| Refresh cookie keeps `Path=/api/auth`, and follows the route constants                                                                                               | —                                               | `routes.spec.ts` (Task 1), `refresh-cookie.spec.ts` (existing)        | `stay-signed-in.spec.ts` (Task 7)                         |
| `pnpm db:seed` creates the first Admin with only `DATABASE_URL` and `SEED_*`, and does nothing when an Admin exists                                                  | `env-schema.spec.ts` seed schema (Task 5)       | `seed-module.spec.ts` (Task 5), `seed.spec.ts` (Task 3)               | —                                                         |
| In the browser: sign in, open a room, sign out as before                                                                                                             | —                                               | —                                                                     | `conversation.spec.ts`, `stay-signed-in.spec.ts` (Task 7) |

**Unit run:** `pnpm test`
**Integration run:** `pnpm exec vitest run --project backend`
**E2E run:** `mkdir -p docs/superpowers/evidence/2026-11-22-backend-nestjs-alignment && E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-22-backend-nestjs-alignment pnpm test:e2e > docs/superpowers/evidence/2026-11-22-backend-nestjs-alignment/e2e.log 2>&1`
**E2E evidence:** `docs/superpowers/evidence/2026-11-22-backend-nestjs-alignment/` — the run log, plus a video, a screenshot at the end of each test and a Playwright trace under `artifacts/` (Task 7 wires this up). The repo has no pure-unit project, so "Unit" is the whole Vitest run (all packages, writes the lcov Sonar reads) and "Integration" is the backend project against real Postgres.

## Quality Gates

All five whole-project levels were green on the base commit `11cffda` (`pnpm check`: 36 test files, 430 tests, 95% line coverage), so none is scoped to changed files.

**Format run:** `pnpm format:check`
**Lint run:** `pnpm lint`
**Typecheck run:** `pnpm typecheck`
**Build run:** none — there is no root or backend build script (`nest start` compiles with swc on every start, which the e2e run exercises) and the frontend build is untouched
**Sonar run:** `pnpm sonar`

## Review Focus

1. A blank `JWT_SECRET=` (as in `.env.example`) must make the backend refuse to start, naming `JWT_SECRET`. Pinned in Task 5 (`env-schema.spec.ts`, `startup.spec.ts`).
2. `PORT` unset means 3000; `PORT=abc` is refused, naming `PORT`. Pinned in Task 5 (`env-schema.spec.ts`).
3. `pnpm db:seed` with an Admin already present, blank `SEED_*` and no `JWT_SECRET` or LiveKit variables must finish without error. Pinned in Task 5 (`seed-module.spec.ts`).
4. Refresh rotation racing a lock must still revoke the new token after `RefreshTokenService` moves. Pinned in Task 3 by running `refresh.spec.ts` and `lock-user.spec.ts`.
5. A locked or demoted User holding a still-valid Auth Token must be rejected once the guard reads through `UsersService`. Pinned in Task 3 by running `locked-user.spec.ts` and `admin-users.spec.ts`.

---

### Task 1: Route constants

**Files:**

- Create: `backend/src/routes.ts`
- Create: `backend/test/routes.spec.ts`
- Create: `backend/test/structure.spec.ts`
- Modify: `backend/src/configure-app.ts`, `backend/src/auth/refresh-cookie.ts`, `backend/src/auth/auth.controller.ts`

**Interfaces:**

- Produces: `API_PREFIX = 'api'`, `AUTH_PATH = 'auth'`, `AUTH_ROUTES = \`/${API_PREFIX}/${AUTH_PATH}\``from`backend/src/routes.ts`. `structure.spec.ts`has a local`sourceFiles(): { path: string; text: string }[]`(every`.ts`under`backend/src`except`generated/`, path relative to `src/`) that later tasks reuse.

- [ ] **Step 1: Branch and commit the design and plan**

```bash
git switch -c refactor/backend-nestjs-alignment
git add docs/superpowers/specs docs/superpowers/plans
git commit -m "docs: add backend NestJS alignment design and plan" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the failing tests**

`routes.spec.ts`, using `startTestApp`, `stopTestApp`, `PASSWORD` and `refreshCookieSetBy` as `refresh-cookie.spec.ts` does:

```ts
it('serves the auth routes under the API prefix and scopes the refresh cookie to them', async () => {
  const response = await request(app.getHttpServer())
    .post(`/${API_PREFIX}/${AUTH_PATH}/register`)
    .send({ email: 'ada@example.test', password: PASSWORD });

  expect(response.status).toBe(201);
  expect(refreshCookieSetBy(response).path).toBe(`/${API_PREFIX}/${AUTH_PATH}`);
});
```

`structure.spec.ts`, test `spells the API prefix and the auth path only in routes.ts`: collect the paths of files other than `routes.ts` whose text matches ``/['"`]\/?api(\/|['"`])/`` and expect that list to equal `[]`.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec vitest run --project backend routes structure`
Expected: FAIL — `routes.spec.ts` cannot resolve `../src/routes.js`; `structure.spec.ts` lists `configure-app.ts` and `auth/refresh-cookie.ts`.

- [ ] **Step 4: Implement**

Create `routes.ts` with the three constants. `configureApp` calls `app.setGlobalPrefix(API_PREFIX)`. `AuthController` becomes `@Controller(AUTH_PATH)`. `refresh-cookie.ts` drops its local `AUTH_ROUTES` and uses the imported one as the cookie `path`.

- [ ] **Step 5: Run to verify they pass**

Run: `pnpm exec vitest run --project backend routes structure refresh-cookie rate-limits sign-in register`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "refactor(backend): declare the API prefix and auth path once" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 2: Split `auth/` by role and move the throttler to `AppModule`

**Files:**

- Create: `backend/src/auth/authenticated-request.ts`, `backend/src/auth/auth.types.ts`
- Move into new folders with `git mv`: `auth/authentication.guard.ts` and `auth/role.guard.ts` to `auth/guards/`; `auth/account-locked.exception.ts` to `auth/exceptions/`
- Create: `auth/decorators/public.decorator.ts`, `auth/decorators/current-user.decorator.ts`, `auth/decorators/admin-only.decorator.ts`
- Modify: `auth/auth.service.ts`, `auth/auth.controller.ts`, `auth/auth.module.ts`, `app.module.ts`, `users/users.controller.ts`, `livekit/room-token.controller.ts`, `health/health.controller.ts`
- Test: `backend/test/structure.spec.ts`

**Interfaces:**

- Consumes: nothing from Task 1 beyond `sourceFiles()`.
- Produces: `AuthenticatedRequest` (`interface … extends Request { user: User }`); `Public` and `PUBLIC_ROUTE`; `CurrentUser`; `AdminOnly`; `AuthenticationGuard`; `RoleGuard`; `AccountLockedException`; types `ValidRegisterRequest`, `ValidSignInRequest`, `SignedIn` — each from the path in the file list above.

- [ ] **Step 1: Write the failing assertions in `structure.spec.ts`**

One `it` each:

- files named `*.guard.ts`, `*.decorator.ts`, `*.exception.ts` live only under `auth/guards/`, `auth/decorators/`, `auth/exceptions/` respectively;
- `ThrottlerModule.forRoot` appears only in `app.module.ts`;
- `interface AuthenticatedRequest` is declared exactly once, and no source file contains `Request & {`;
- `export type ValidRegisterRequest` appears only in `auth/auth.types.ts`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project backend structure`
Expected: FAIL — the four assertions list today's file locations.

- [ ] **Step 3: Move and split**

`PUBLIC_ROUTE` and `Public` move to `public.decorator.ts`. `CurrentUser` moves to `current-user.decorator.ts` and reads the request as `AuthenticatedRequest`. `AdminOnly` moves to `admin-only.decorator.ts` (`UseGuards(RoleGuard)`). `RoleGuard` reads `context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>()` instead of its own request type. `AuthService`'s three exported types move to `auth.types.ts`. Update every importer. Move `ThrottlerModule.forRoot({ throttlers: [{ ttl: minutes(1), limit: 5 }], errorMessage: … })` with its comment from `AuthModule` to `AppModule` unchanged; `ThrottlerModule` is `@Global()` in 6.7.1, so the `@UseGuards(ThrottlerGuard)` on `AuthController` still resolves it.

- [ ] **Step 4: Run the structure test and the full backend suite**

Run: `pnpm exec vitest run --project backend`
Expected: PASS, including `rate-limits.spec.ts`, `admin-users.spec.ts`, `current-user.spec.ts` and `health.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "refactor(backend): split auth into guards, decorators and exceptions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 3: `UsersModule` owns the User table; `RefreshTokensModule`; seed through Nest

**Files:**

- Create: `backend/src/refresh-tokens/refresh-tokens.module.ts`, `backend/src/users/user.mapper.ts`, `backend/src/seed.module.ts`
- Move: `auth/refresh-token.service.ts` to `refresh-tokens/refresh-token.service.ts`
- Delete: `backend/src/auth/users.ts`
- Modify: `users/users.service.ts`, `users/users.module.ts`, `users/first-admin.ts`, `auth/auth.service.ts`, `auth/auth.module.ts`, `auth/guards/authentication.guard.ts`, `auth/refresh-cookie.ts`, `seed.ts`
- Test: `backend/test/structure.spec.ts`, `backend/test/seed.spec.ts`, `backend/test/admins.ts`

**Interfaces:**

- Consumes: Task 2's guard and decorator paths.
- Produces:
  - `RefreshTokensModule` exports `RefreshTokenService`; it imports `PrismaModule` and nothing from `auth/` or `users/`.
  - `UsersService` gains `findById(id: string): Promise<UserRecord | null>`, `findByEmail(email: string): Promise<UserRecord | null>`, `findAnAdmin(): Promise<UserRecord | null>`, `create(data: { email: string; passwordHash: string; role?: Role }): Promise<UserRecord>`, where `UserRecord` is `User` from `../generated/prisma/client.js`.
  - `UsersModule` imports `PrismaModule` and `RefreshTokensModule`, exports `UsersService`, and does not import `AuthModule`. `AuthModule` imports `UsersModule` and `RefreshTokensModule`.
  - `users/user.mapper.ts` exports `toUser(record: UserRecord): User` and `toUserDetails(record: UserRecord): UserDetails`.
  - `seedFirstAdmin(users: UsersService, env: Environment): Promise<FirstAdminSeed>`.
  - `SeedModule` (imports `PrismaModule`, `UsersModule`), used by `seed.ts` with `NestFactory.createApplicationContext`.

- [ ] **Step 1: Write the failing tests**

In `seed.spec.ts` and `admins.ts`, replace `app.get(PrismaService)` with `app.get(UsersService)`. In `structure.spec.ts`, add one `it` each:

- no source file except `users/users.service.ts` matches `/\b(prisma|transaction)\.user\./`;
- `auth/users.ts` does not exist;
- no file under `refresh-tokens/` imports from `../auth/` or `../users/`, and `users/users.module.ts` does not import `auth.module`;
- no file under `auth/` imports `prisma.service`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec vitest run --project backend structure seed`
Expected: FAIL — the seed tests throw because `seedFirstAdmin` still calls `prisma.user` on a `UsersService`; `structure.spec.ts` lists `auth.service.ts`, `authentication.guard.ts` and `first-admin.ts`.

- [ ] **Step 3: Implement**

- `git mv` the refresh-token service; `RefreshTokensModule` provides and exports it. `refresh-cookie.ts` imports `REFRESH_TOKEN_LIFETIME_MILLISECONDS` from the new path.
- `UsersService` adds the four methods above, implemented with `this.prisma.user`; its mapper and `toUserDetails` come from `user.mapper.ts`, and it keeps its admin operations.
- `AuthService` injects `UsersService` in place of `PrismaService`: `register` calls `users.create`, `signIn` calls `users.findByEmail`. The unique-violation (`P2002`) to `409` conversion stays in `AuthService`. `AuthenticationGuard` injects `UsersService` and calls `findById`. Neither injects `PrismaService`.
- `seedFirstAdmin(users, env)` uses `findAnAdmin`, `findByEmail`, `create({ email, passwordHash, role: 'admin' })` and keeps its error messages.
- `seed.ts` creates the application context from `SeedModule`, calls `seedFirstAdmin(app.get(UsersService), process.env)`, keeps its two log lines, and closes the context in `finally` (closing runs `PrismaService.onModuleDestroy`). Task 5 changes the second argument.

- [ ] **Step 4: Run the full backend suite**

Run: `pnpm exec vitest run --project backend`
Expected: PASS. Pay attention to `refresh.spec.ts`, `lock-user.spec.ts`, `locked-user.spec.ts`, `admin-users.spec.ts`, `set-password.spec.ts` and `seed.spec.ts` (Review Focus 4 and 5). A Nest "circular dependency" error at startup means a module import was wired wrongly.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "refactor(backend): let UsersModule own the User table" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 4: `PrismaModule` stops being global; test helpers move to `test/support/`

**Files:**

- Modify: `backend/src/prisma/prisma.module.ts`, `backend/src/app.module.ts`
- Move with `git mv` into `backend/test/support/`: `test-app.ts`, `users.ts`, `admins.ts`, `admin-api.ts`, `auth-tokens.ts`, `refresh-cookies.ts`
- Modify: every `backend/test/*.spec.ts` import of those helpers; the helpers' own relative imports (`../src/…` becomes `../../src/…`, `./database/…` becomes `../database/…`)
- Test: `backend/test/structure.spec.ts`

**Interfaces:**

- Consumes: Task 3's `UsersModule` and `RefreshTokensModule`, each already importing `PrismaModule`.
- Produces: `PrismaModule` without `@Global()`; helper modules at `backend/test/support/*.ts` with unchanged exports.

- [ ] **Step 1: Write the failing assertions in `structure.spec.ts`**

- no source file contains `@Global(`;
- every entry directly under `backend/test/` is either a directory or ends in `.spec.ts`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project backend structure`
Expected: FAIL — lists `prisma/prisma.module.ts` and the six helper files.

- [ ] **Step 3: Implement**

Remove `@Global()` from `PrismaModule`. Remove `PrismaModule` from `AppModule.imports` (the two modules that need it import it). Move the helpers and fix imports.

- [ ] **Step 4: Run the full backend suite**

Run: `pnpm exec vitest run --project backend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "refactor(backend): make PrismaModule non-global and group test helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 5: `@nestjs/config` validates the environment; Prisma and the seed read it

**Files:**

- Modify: `backend/package.json` and `pnpm-lock.yaml` (add `@nestjs/config` `^12.1.1`)
- Create: `backend/src/config/env.schema.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/seed.module.ts`, `backend/src/seed.ts`, `backend/src/main.ts`, `backend/src/prisma/prisma.service.ts`, `backend/src/users/first-admin.ts` (rename its local `seedEnvSchema` to `seedAdminSchema`), `backend/test/support/test-app.ts`, `backend/test/startup.spec.ts`
- Create: `backend/test/env-schema.spec.ts`, `backend/test/seed-module.spec.ts`

**Interfaces:**

- Consumes: `liveKitEnvSchema`, `LiveKitEnv` from `@open-live-agent/shared`; Task 3's `SeedModule` and `seedFirstAdmin(users, env)`; Task 4's `test/support/test-app.ts`.
- Produces, from `config/env.schema.ts`: `backendEnvSchema` (`liveKitEnvSchema.extend({ PORT: z.coerce.number().int().positive().default(3000), DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }), JWT_SECRET: z.string().min(32) })`), `type BackendEnv = z.output<typeof backendEnvSchema>`, `seedEnvSchema` (`DATABASE_URL` same rule; `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` as `z.string().optional()`), `type DatabaseEnv = Pick<BackendEnv, 'DATABASE_URL'>`.
- Produces: `AppModule.register(): Promise<DynamicModule>` and `SeedModule.register(): Promise<DynamicModule>`; each awaits `ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validationSchema: <its schema> })` and returns `{ module, imports: [thatModule] }`. `PrismaService`'s constructor takes `ConfigService<DatabaseEnv, true>`. Read values with `config.getOrThrow('NAME', { infer: true })` — without `{ infer: true }` the return type is `any`.

- [ ] **Step 1: Write the failing tests**

`env-schema.spec.ts` (the "Unit" level), against `backendEnvSchema` and `seedEnvSchema` directly:

- a complete valid environment parses, with `PORT` defaulting to `3000`;
- removing each of `DATABASE_URL`, `JWT_SECRET`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AGENT_NAME` fails, and the issue's path names it;
- `JWT_SECRET: ''` and a 31-character secret fail naming `JWT_SECRET`;
- `PORT: 'abc'` fails naming `PORT`; `PORT: '8080'` parses to the number `8080`;
- `LIVEKIT_URL: 'https://livekit.test'` and `DATABASE_URL: 'mysql://localhost/x'` fail;
- unrelated variables such as `PATH` do not fail it;
- `seedEnvSchema` accepts an environment with only `DATABASE_URL`, and accepts blank `SEED_ADMIN_PASSWORD`.

`seed-module.spec.ts` (integration): stub only `DATABASE_URL` from `testEnv`, and stub `JWT_SECRET` and the four LiveKit variables to `undefined`. Build `Test.createTestingModule({ imports: [await SeedModule.register()] }).compile()` and take `UsersService`. Test 1: `seedFirstAdmin(users, { SEED_ADMIN_EMAIL: 'grace@example.test', SEED_ADMIN_PASSWORD: PASSWORD })` returns `outcome: 'created'` and `users.findByEmail('grace@example.test')` has `role` `'admin'`. Test 2: with an Admin present, `seedFirstAdmin(users, { SEED_ADMIN_EMAIL: '', SEED_ADMIN_PASSWORD: '' })` resolves to `{ outcome: 'admin-exists' }`.

`startup.spec.ts`: keep its three specific refusals; change the per-variable test to take names from `Object.keys(testEnv)` and expect `rejects.toThrow(new RegExp(name))` (the `Invalid … settings` headings go away); add `PORT: 'abc'` rejecting with `/PORT/`.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec vitest run --project backend env-schema seed-module startup`
Expected: FAIL — `config/env.schema.js` and `SeedModule.register` do not exist.

- [ ] **Step 4: Add the dependency and the schema**

Run: `pnpm --filter @open-live-agent/backend add @nestjs/config@^12.1.1`, then create `env.schema.ts`.
Run: `pnpm exec vitest run --project backend env-schema`
Expected: PASS

- [ ] **Step 5: Wire `ConfigModule` into the app**

`AppModule.register()` as specified. `main.ts` creates the app from `await AppModule.register()` and reads the port with `app.get<ConfigService<BackendEnv, true>>(ConfigService).getOrThrow('PORT', { infer: true })`. `PrismaService` takes `ConfigService<DatabaseEnv, true>` and builds `PrismaPg` from `DATABASE_URL`; it no longer imports `parseEnv`. `startTestApp` passes `await AppModule.register()` to `createTestingModule`. `AuthModule` and `LiveKitModule` still read `process.env` until Task 6.

- [ ] **Step 6: Wire it into the seed**

`SeedModule.register()` uses `seedEnvSchema`. `seed.ts` passes `{ SEED_ADMIN_EMAIL: config.get('SEED_ADMIN_EMAIL', { infer: true }), SEED_ADMIN_PASSWORD: config.get('SEED_ADMIN_PASSWORD', { infer: true }) }` to `seedFirstAdmin`, so it no longer reads `process.env`.

- [ ] **Step 7: Run the full gate**

Run: `pnpm check`
Expected: PASS — format, lint, typecheck and all tests. If vitest reports an unhandled rejection from `startup.spec.ts`, the rejection is escaping `register()`; make sure `startTestApp` awaits it.

- [ ] **Step 8: Commit**

```bash
git add backend pnpm-lock.yaml
git commit -m "refactor(backend): validate the environment once with @nestjs/config" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 6: Auth and LiveKit read `ConfigService`

**Files:**

- Modify: `backend/src/auth/auth.module.ts`, `backend/src/livekit/livekit.module.ts`, `backend/src/livekit/room-token.service.ts`
- Delete: `backend/src/livekit/livekit-config.ts`
- Test: `backend/test/structure.spec.ts`

**Interfaces:**

- Consumes: `BackendEnv`, `LiveKitEnv`, the global `ConfigService` from Task 5.
- Produces: `RoomTokenService` constructor `(config: ConfigService<LiveKitEnv, true>)` reading `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AGENT_NAME`; `JwtModule.registerAsync({ inject: [ConfigService], useFactory })` reading `JWT_SECRET`. `LIVEKIT_CONFIG`, `LiveKitConfig` and `loadLiveKitConfig` no longer exist.

- [ ] **Step 1: Write the failing assertions in `structure.spec.ts`**

- no source file contains `process.env`;
- `parseEnv` appears only in `users/first-admin.ts`;
- `livekit/livekit-config.ts` does not exist.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project backend structure`
Expected: FAIL — lists `auth/auth.module.ts`, `livekit/livekit.module.ts` and `livekit/livekit-config.ts`.

- [ ] **Step 3: Implement**

`AuthModule`'s factory returns the same `{ secret, signOptions: { algorithm: 'HS256', expiresIn: '15m' }, verifyOptions: { algorithms: ['HS256'] } }` with `secret` from `ConfigService`, and loses `authEnvSchema`. `RoomTokenService` builds the token exactly as now, taking the key, secret, agent name and server URL from `ConfigService`; `ROOM_TOKEN_TTL` stays. `LiveKitModule.providers` is `[RoomTokenService]`.

- [ ] **Step 4: Run the full gate**

Run: `pnpm check`
Expected: PASS, including `room-token.spec.ts`, `sign-in.spec.ts` and the structure assertions.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "refactor(backend): read auth and LiveKit settings through ConfigService" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 7: End-to-end scenarios

No production code. `conversation.spec.ts` (register, start a Conversation, End) and `stay-signed-in.spec.ts` (refresh cookie survives a reload, sign-out sticks) already state the browser scenario in the spec's own words, so this task adds no duplicate tests. It adds evidence capture and proves the cookie test can fail.

**Files:**

- Modify: `e2e/playwright.config.ts`

**Interfaces:**

- Consumes: the finished backend from Tasks 1–6.
- Produces: an optional `E2E_EVIDENCE_DIR` environment variable. When set, Playwright uses `outputDir: path.resolve(<dir>, 'artifacts')` and `use: { video: 'on', screenshot: 'on', trace: 'on' }`. When unset, the config is unchanged.

- [ ] **Step 1: Add evidence capture to `e2e/playwright.config.ts`**

Keep `trace: 'retain-on-failure'` and no `outputDir` change when the variable is unset.

- [ ] **Step 2: Run the e2e suite with evidence**

Run: the **E2E run** command from the Test Strategy section.
Expected: PASS for both specs; `e2e.log` and `artifacts/` exist under the evidence directory.

- [ ] **Step 3: Prove the cookie scenario can fail**

Temporarily change the `path` in `REFRESH_COOKIE_OPTIONS` in `backend/src/auth/refresh-cookie.ts` to `` `${AUTH_ROUTES}/other` ``, then run `pnpm test:e2e`.
Expected: FAIL — `stay-signed-in.spec.ts`, because the browser no longer sends the refresh cookie to `/api/auth/refresh`.
Then restore: `git checkout -- backend/src/auth/refresh-cookie.ts`

- [ ] **Step 4: Commit**

```bash
git add e2e/playwright.config.ts
git commit -m "test(e2e): capture video, screenshots and traces into an evidence directory" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
