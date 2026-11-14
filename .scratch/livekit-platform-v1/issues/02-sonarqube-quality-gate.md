# 02: SonarQube quality gate

**What to build:** A developer, or an AI agent, runs one command that scans the whole repo with a local SonarQube and gets a clear pass or fail against the project's quality gate. On failure, the command prints the issues that caused it, so the agent can fix them and scan again. The team has no SonarQube server, so SonarQube Community Build runs locally in Docker. Setting it up is fully scripted, so no human has to click through its UI. This turns quality layer 3 from the spec into a deterministic check that every later ticket must pass. See the spec's Implementation Decisions: Quality gates.

**Blocked by:** 01 (Anonymous Conversation tracer bullet)

**Status:** done

- [ ] Docker Compose has a SonarQube Community Build service, with its own Postgres database or embedded storage, under a separate Compose profile. A plain `docker compose up` for development doesn't start it.
- [ ] `pnpm sonar:up` starts SonarQube and waits until it is healthy.
- [ ] `pnpm sonar:setup` is idempotent. Through SonarQube's Web API it:
  - changes the default admin password to `SONAR_ADMIN_PASSWORD` from the git-ignored env;
  - creates the project;
  - creates the project's quality gate and makes it the default;
  - generates an analysis token and writes it to the git-ignored env as `SONAR_TOKEN`.
- [ ] The quality gate is "LiveKit Platform Gate". Its conditions apply to overall code: in a greenfield repo all code is new, and Community Build has no branch analysis. They are:
  - reliability, security and maintainability ratings of A;
  - coverage of at least 80%;
  - duplicated lines of at most 3%;
  - Security Hotspots reviewed at 100%.
- [ ] Analysis settings:
  - covers every package;
  - excludes generated code, build output and test fixtures from analysis;
  - excludes test files from coverage;
  - imports each package's `lcov` report from `pnpm test`.
- [ ] `pnpm sonar` runs `pnpm test` with coverage, then the scanner. The scanner runs as a Docker image or the npm scanner, so no global install is needed.
- [ ] `pnpm sonar` waits for the quality gate result and exits non-zero when the gate fails.
- [ ] When the gate fails, `pnpm sonar` prints each failed condition and the open issues and unreviewed Security Hotspots, each with file, line, rule and message. It reads them from the Web API.
- [ ] The README, or a short doc linked from it, explains the three quality layers and the commands `sonar:up`, `sonar:setup` and `sonar`. It also says that only a human may mark a Security Hotspot as safe.
- [ ] Running `pnpm sonar` on the code from ticket 01 passes the gate. Any finding is fixed in code, not suppressed.
- [ ] Definition of done: `pnpm check` and `pnpm sonar` both pass.

## Comments

### 2026-11-14, implementer (branch `ticket/02-sonarqube-gate`)

**Result.** SonarQube Community Build 26.11 runs in Docker, and `pnpm sonar` passes the LiveKit Platform Gate on the ticket 01 code plus this ticket's tests: overall coverage 88.3% (lines 89.3%, conditions 84.2%), duplication 0.0%, A ratings, no open issues. SonarQube found nothing to fix in ticket 01's code.

**Security Hotspots: none.** SonarQube reported 0.

**The coverage gap was closed with tests, not exclusions** (43% before):

- S2 (Agent): env parsing, the `fake` Provider's session options, and Room dispatch. The dispatch test runs the Agent's `entry` in a fake job, as the framework's own console mode does: a real `JobContext` with `fakeJob: true` and a real unconnected `@livekit/rtc-node` Room. It asserts that the Agent joins the room and logs "Conversation started" and "Conversation ended" with the room name.
- S3 (frontend): Start, the Agent joining, End, a new Room Token for the next Conversation, and the app opening on the Conversation page. MSW serves `/api`; a real `livekit-client` Room never connects (its `connect`, `disconnect`, `prepareConnection` and `setMicrophoneEnabled` are stubbed). Tickets 03 and 04 can reuse `frontend/test/unconnected-room.ts` and `frontend/test/backend.ts`.
- S1 (backend): startup refuses missing or invalid LiveKit settings.
- To make this possible, `ConversationPage` now takes its `room` as a prop (`main.tsx` passes `new Room()`), and the agent definition moved from `agent/src/main.ts` to `agent/src/conversation-agent.ts`. S4 still passes.

**Left uncovered, for human review.** These are kept thin, and S4 runs them:

- `agent/src/main.ts` (3 lines): removes `WATCH_REPORT_DEPENDENCIES`, reads the env, calls `cli.runApp`. Running it starts an agent server that registers with LiveKit.
- `backend/src/main.ts` (5 lines): parses `PORT`, creates the Nest app, listens. `configureApp`, which S1 uses, holds the app settings.
- One branch each in `room-token-source.ts` (Room Token failure: ticket 04 adds that UI), `room-token.controller.ts` (decorator metadata emitted by the compiler) and the shadcn `button.tsx` (`asChild`).

**Decisions that need human approval** (SonarQube configuration, per `CODING_STANDARDS.md`):

1. **Analysis scope.** `sonar.sources` is the `src` of shared, backend, agent and frontend; `sonar.tests` is each package's `test` directory and all of `e2e`. Repo tooling (`scripts/`, `.claude/hooks/`) and build config files (`eslint.config.ts`, `*/vitest.config.ts`, `vite.config.ts`) are not analyzed. The ticket asks for "every package", and the tooling would otherwise dominate the coverage figure (the Sonar scripts alone are larger than the app code). ESLint with `eslint-plugin-sonarjs` still checks them, and the Sonar scripts have 25 tests of their own.
2. **Exclusions.** `sonar.exclusions=**/generated/**` is there for generated code such as a future Prisma client; nothing matches it today. `sonar.coverage.exclusions` lists only test files. shadcn components under `frontend/src/components/ui` count as source code.
3. **`SONAR_TOKEN` is an admin user token**, not a project analysis token. On 26.11, a project analysis token can scan and read the gate and issues, but gets 403 from `hotspots/search`, `project_analyses/search` and `measures/component_tree`. The same `.env` already holds the admin password, and SonarQube listens on 127.0.0.1 only. The alternative is a dedicated non-admin user with Browse and Execute Analysis.
4. **A local default admin password is committed** in the root `.env.example` (`SONAR_ADMIN_PASSWORD=Local-Sonar-Admin-1`), so any new worktree can run `cp .env.example .env && pnpm sonar:setup`. This is the same pattern as LiveKit's `devkey`/`secret`. Every checkout must use the same value.
5. **The gate uses the MQR metrics** (`software_quality_reliability_rating` and the like), since 26.11 runs in Multi-Quality Rule mode by default. A new gate in 26.11 starts with four Clean as You Code conditions on new code; `sonar:setup` removes them because this gate applies to overall code.
6. **Embedded H2 storage** in the named volumes `livekit-platform_sonarqube-{data,extensions,logs}`. `docker compose --profile sonar down -v` resets SonarQube; every checkout then reruns `pnpm sonar:setup`.
7. **New dev dependencies:** root: `@sonar/scan` 5.1 (the npm scanner; it downloads its JRE and engine from the local SonarQube, so Java isn't needed), `msw` and `zod` (for the scripts). Frontend: `vitest`, `jsdom`, Testing Library, `@testing-library/jest-dom`, `msw` 3. Agent: `vitest` and `@livekit/protocol` (to build the fake job).
8. The root `tsconfig.json` now includes `scripts/**/*.ts` instead of `scripts/*.ts`. The ESLint, Prettier and TypeScript compiler settings are unchanged.

**How the failure path was checked.** With a temporary file that used `createHash('md5')`, `pnpm sonar` exited 1 and printed `software_quality_security_rating is D, but must be A` and `frontend/src/zz-sonar-probe.ts:5  typescript:S4790  Make sure this weak hash algorithm is not used in a sensitive context here.` The file was deleted and never committed.

**Environment.** Docker Desktop has 7.65 GB of memory, and SonarQube uses about 2.5 GB. The image is 2.5 GB; pulling it took about 45 minutes on this network.
