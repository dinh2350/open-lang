# 07: Register and sign in; Conversations need a signed-in User

**What to build:** A person registers with their email and a password and is signed in right away as a Member. A returning User signs in with the same details. Only a signed-in User can open the Conversation page or get a Room Token, and that User's id becomes their identity in the room. A signed-out person is sent to the sign-in page. Sign-in doesn't survive a reload yet; ticket 08 adds that. See the spec's Backend decisions (Data model, Auth API, Auth Token, Guards, Room Token endpoint), ADR 0002 and ADR 0003.

**Blocked by:** 01 (Anonymous Conversation tracer bullet), 02 (SonarQube quality gate)

**Status:** done

- [ ] Docker Compose also runs Postgres. The backend reaches it through Prisma.
- [ ] The root script `db:migrate` exists.
- [ ] A User has an id, a unique email, an argon2 password hash, a Role (always Member in this ticket), and timestamps.
- [ ] Register takes an email and password, with at least 12 characters and no composition rules. It creates a Member and returns `201` with an Auth Token and the User.
- [ ] Register rejects an invalid email or short password with a clear validation error, and a taken email with a clear `409`.
- [ ] Sign in returns an Auth Token and the User. A wrong email or wrong password gives `401` with the same generic message.
- [ ] A current-User endpoint returns the signed-in User.
- [ ] Register and sign in are each limited to 5 requests per minute per IP.
- [ ] The Auth Token is an HS256 JWT signed with `JWT_SECRET`. It expires after 15 minutes and carries the User id and Role.
- [ ] The authentication guard verifies the Auth Token and loads the User from the database on every request.
- [ ] `/api/token` returns `401` without a valid Auth Token.
- [ ] With a valid Auth Token, the Room Token's participant identity is the User id. Every other Room Token rule from ticket 01 still holds.
- [ ] The frontend has sign-in and register pages and keeps the Auth Token in memory only.
- [ ] A signed-out person who opens the Conversation page is redirected to sign-in.
- [ ] After registering or signing in, the person lands on the Conversation page.
- [ ] S1 tests use Postgres through Testcontainers, with one database per Vitest worker, migrated once, and tables truncated before each test. They cover:
  - register and sign-in rules;
  - the generic error;
  - the rate limits;
  - the current-User endpoint;
  - `/api/token` with and without an Auth Token, checking the identity.
- [ ] S3 tests cover the sign-in and register flows and errors, and the signed-out redirect, with MSW serving `/api`.
- [ ] The S4 smoke test now registers a new User before pressing Start.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.

## Comments

### 2026-11-14, implementer (branch `ticket/07-register-sign-in`)

**Result.** Every acceptance criterion is met, on top of the integration branch with ticket 04 merged (`c5d879c`). `pnpm check` passes (106 tests). `pnpm sonar` passes the gate: coverage 94.6% (lines 96.4%, conditions 89.5%), duplication 0.0%, A/A/A, 0 issues. `pnpm test:e2e` passes: the smoke test registers a new User, then Start, the Agent joins, End.

**Security Hotspots: none.** SonarQube reported 0.

**Needs human approval (config changes, per `CODING_STANDARDS.md`):**

1. **ESLint now ignores `**/generated/`** (`eslint.config.ts` `globalIgnores`, next to `**/dist/`). Prisma 7's `prisma-client` generator writes TypeScript into `backend/src/generated/prisma`, and every file starts with an unlimited `/* eslint-disable */` and `// @ts-nocheck`. That fails `eslint-comments` 27 times, and it can't be fixed in generated code. The path is git-ignored, Sonar already excludes `**/generated/**` (ticket 02 added it for this client), and Prettier skips it through .gitignore. The alternative, the legacy `prisma-client-js` generator into `node_modules`, is deprecated in Prisma 7.
2. **pnpm build-script allowlist** (`pnpm-workspace.yaml`): `@prisma/engines` (downloads the schema engine that `prisma migrate` runs), `prisma` (Node version check) and `argon2` (uses its prebuilt binary, or compiles one where none ships, such as Intel Macs) may run install scripts. `cpu-features`, `ssh2` (optional SSH speedups from Testcontainers' Docker client) and `protobufjs` (a version notice) are ignored.

**Decisions to review:**

- **Prisma 7.10.1, pinned to `^7.10.1`.** npm's `latest` tag for the `prisma` CLI points at `8.0.0-rc.33`, a release candidate; `@prisma/client`'s `latest` is 7.10.1. Prisma 7 needs the `@prisma/adapter-pg` driver adapter, doesn't read `.env` (`backend/prisma.config.ts` loads `backend/.env`; variables already set win), and its `migrate dev` no longer runs `generate`. So `pnpm db:migrate` = `prisma generate && prisma migrate dev`, and the backend's `postinstall` runs `prisma generate`.
- **Postgres** is `postgres:18-alpine`, published on `127.0.0.1:${POSTGRES_PORT:-5432}`. `POSTGRES_PORT` lives in the root `.env` (Compose reads it); `backend/.env`'s `DATABASE_URL` must use the same port. The local default credentials (`livekit_platform`) are committed in `docker-compose.yml` and `backend/.env.example`, like LiveKit's `devkey`/`secret`.
- **`JWT_SECRET` is empty in `backend/.env.example`** (user story 4: keep it out of git). The backend refuses to start until it is set to at least 32 characters; the README says to run `openssl rand -base64 48`. Tests and S4 generate a random one per run.
- **The authentication guard is global** (`APP_GUARD`): every route needs a signed-in User unless it is marked `@Public()` (health, register, sign-in). The spec doesn't say global or per route; global means a new route is protected by default. Ticket 08's refresh and sign-out routes must be `@Public()`.
- **API shape:** `POST /api/auth/register` (201), `POST /api/auth/sign-in` (200, since it creates nothing), `GET /api/auth/me`. Bodies are camelCase: `{ authToken, user: { id, email, role } }`. Role values are `member` and `admin`, in Postgres too. Errors keep NestJS's standard body (`errorResponseSchema` in shared). Messages: 409 `An account with this email already exists.`, 401 `Wrong email or password.`, 429 `Too many attempts. Wait a minute, then try again.`.
- **Emails are trimmed and lowercased** by the shared schema, so `Ada@Example.test` and `ada@example.test` are the same account.
- **Sign-in checks a dummy argon2 hash when the email is unknown**, so response time doesn't reveal whether an email has an account. Passwords are hashed with argon2id at the library defaults.
- **The User table has no `locked` column yet**: the ticket lists id, email, password hash, Role and timestamps. Ticket 10 adds it.
- **Frontend:** `AuthProvider` keeps the User in state and the Auth Token in a ref (memory only). Its `authorizedFetch` adds the Bearer header, and the Conversation page passes it to ticket 04's `createRoomTokenSource`; that is the only change to the page. Outside an `AuthProvider`, as in the Conversation page's own S3 specs, the default context is signed out and `authorizedFetch` is plain `fetch`, so those specs didn't change. The S3 fake records each Room Token request's `Authorization` header but doesn't enforce it. The sign-in and register forms validate with the shared schemas before sending, so a typo costs no rate-limited attempt. They show the backend's message for any 4xx and "Something went wrong. Try again." otherwise.
- **S1:** each test starts its own app, because the throttler counts per app instance; every test also starts on empty tables. Global setup migrates a template database once; each Vitest worker copies it with `CREATE DATABASE ... TEMPLATE`. `pnpm test` now needs Docker.
- **S4** uses its own database, `livekit_platform_e2e`, on the Compose Postgres; the backend web server runs `prisma migrate deploy` before it starts. Users registered by earlier runs stay there (each run's email is unique). I didn't use `prisma migrate reset`: Prisma refuses it when an AI agent runs it, unless a human consents.

**Open issues:**

- **Rate limits count per `req.ip`, and Express doesn't trust proxies.** In dev, every request reaches the backend through the Vite proxy from 127.0.0.1, so all browsers share one count of 5 a minute. Behind a production reverse proxy the same would happen; setting Express's `trust proxy` to the proxy's address fixes it. That is a deployment decision, out of scope here.
- Passwords have no maximum length. Express's default 100 kB JSON body limit bounds what argon2 hashes.
