# Quality gates

Code in this repo, human or AI-written, must pass deterministic checks. They run in three layers, so a mistake is caught as early and as cheaply as possible. `CODING_STANDARDS.md` has the rules for working with them: fix the code, never the scanner.

| Layer | When                   | What runs                                                                                                                     |
| ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1     | On every edit          | A Claude Code `PostToolUse` hook runs Prettier and `eslint --fix` on the edited file and reports the ESLint errors left.      |
| 2     | Every commit and check | The lefthook pre-commit hook (Prettier, ESLint, typecheck on staged files) and `pnpm check` (format, lint, typecheck, tests). |
| 3     | Every ticket           | `pnpm sonar`: SonarQube Community Build, running locally in Docker, scans every package and checks the LiveKit Platform Gate. |

A ticket is done when `pnpm check` and `pnpm sonar` both pass.

## Layer 3: SonarQube

The team has no SonarQube server, so SonarQube Community Build runs in Docker on your machine. Scripts set it up through its Web API; nobody has to click through its UI.

### Commands

| Command            | What it does                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm sonar:up`    | Starts SonarQube (Compose profile `sonar`) on http://localhost:9000 and waits until it is up. The first run pulls a 2.5 GB image; SonarQube then uses about 2.5 GB of Docker memory. A plain `docker compose up` doesn't start it.                                       |
| `pnpm sonar:setup` | Changes the default admin password to `SONAR_ADMIN_PASSWORD`, creates the project and the LiveKit Platform Gate, makes the gate the default, and writes a new analysis token for this checkout to `.env` as `SONAR_TOKEN`. Safe to rerun at any time, from any checkout. |
| `pnpm sonar`       | Runs `pnpm test` with coverage, then the scanner. It waits until SonarQube has processed this scan, prints the result, and exits non-zero when the gate fails.                                                                                                           |

In a new checkout:

```sh
cp .env.example .env   # git-ignored; has a local default admin password
pnpm sonar:up
pnpm sonar:setup
pnpm sonar
```

`pnpm sonar` stops before running the tests when `SONAR_TOKEN` is missing or rejected, and tells you to run `pnpm sonar:setup`. When SonarQube isn't running, it tells you to run `pnpm sonar:up`.

### The LiveKit Platform Gate

The conditions apply to overall code. In a greenfield repo all code is new, and Community Build has no branch analysis.

| Metric                                           | Passes when  |
| ------------------------------------------------ | ------------ |
| Reliability, security and maintainability rating | A            |
| Coverage                                         | at least 80% |
| Duplicated lines                                 | at most 3%   |
| Security Hotspots reviewed                       | 100%         |

`scripts/sonar/project.ts` defines the gate; `pnpm sonar:setup` restores it if someone changed it in the UI.

### What is analyzed

`sonar-project.properties` sets this up:

- The application code of every package (`shared/src`, `backend/src`, `agent/src`, `frontend/src`) and the tests of every package (`*/test`, and all of `e2e`).
- Generated code (`**/generated/**`) and test fixtures are not analyzed. Test files never count toward coverage.
- Coverage comes from the lcov report that `pnpm test` writes for each package.
- Repo tooling (`scripts/`, `.claude/hooks/`) and build configuration files are outside the packages and not analyzed; ESLint (layer 2) still checks them.

### Reading a failure

When the gate fails, `pnpm sonar` prints, in this order:

1. Each failed condition, with its value and threshold, for example `coverage is 43.0, but must be at least 80`.
2. For a coverage or duplication failure, the files with the most uncovered or duplicated lines.
3. Every open issue, then every Security Hotspot to review, one per line as `file:line  rule  message`. Look a rule up at http://localhost:9000/coding_rules.
4. A link to the project dashboard.

It prints open issues even when the gate passes. Fix them in the code too: no `NOSONAR`, no exclusions, no lowered thresholds.

### Security Hotspots

Only a human may mark a Security Hotspot as safe. An agent fixes the code if the hotspot points at a real problem; otherwise it lists the hotspot under `## Comments` in the ticket and stops. Until a human reviews it, the gate fails on "Security Hotspots reviewed".

### Several checkouts, one SonarQube

Every checkout and worktree shares one SonarQube instance and one project:

- Each checkout has its own `.env` and its own analysis token, named after the checkout's path. `pnpm sonar:setup` revokes and regenerates only that token, so other checkouts keep working. The token is an admin user token: a project analysis token can scan but can't read the hotspots and measures that `pnpm sonar` reports, and the same `.env` already holds the admin password.
- Every checkout must use the same `SONAR_ADMIN_PASSWORD`.
- `pnpm sonar` judges the gate of its own analysis, found through the task id in `.scannerwork/report-task.txt`. Issues, hotspots and file measures always belong to the project's latest analysis. If another checkout's scan finished in between, `pnpm sonar` prints a warning; rerun it for an exact list.
