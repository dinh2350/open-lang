# 02: SonarQube quality gate

**What to build:** A developer, or an AI agent, runs one command that scans the whole repo with a local SonarQube and gets a clear pass or fail against the project's quality gate. On failure, the command prints the issues that caused it, so the agent can fix them and scan again. The team has no SonarQube server, so SonarQube Community Build runs locally in Docker. Setting it up is fully scripted, so no human has to click through its UI. This turns quality layer 3 from the spec into a deterministic check that every later ticket must pass. See the spec's Implementation Decisions: Quality gates.

**Blocked by:** 01 (Anonymous Conversation tracer bullet)

**Status:** ready-for-agent

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
