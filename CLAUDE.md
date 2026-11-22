# open-lang

TypeScript monorepo (pnpm workspaces): `agent`, `backend`, `frontend`, `shared`, `e2e`. Postgres and LiveKit run through `docker-compose.yml`.

## Workflow: Superpowers

The Superpowers skills live in `.claude/skills/`. A SessionStart hook (`.claude/hooks/superpowers-session-start`) loads `using-superpowers` into every session. Use the skills as it describes: check for a matching skill before acting, and invoke it with the Skill tool.

- This file and direct requests from the human take precedence over a skill.
- Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`, and verification evidence in `docs/superpowers/evidence/`.
- Before changing behavior, start with `brainstorming`, then `writing-plans`. Write the test first (`test-driven-development`). Debug with `systematic-debugging`, not by guessing.
- Do not claim work is done, fixed or passing until `verification-before-completion` is satisfied by the commands below.

## Quality gates

Fix the code, never the scanner: no `NOSONAR`, `@ts-ignore`, ESLint or Sonar exclusions, or lowered thresholds without a human's approval.

- `pnpm check` runs format check, lint, typecheck and unit tests. Fix every problem it reports.
- `pnpm sonar` runs the tests and the SonarQube scan. It prints each failed condition and every open issue as `file:line  rule  message`; fix them all, even when the gate passes.
- `pnpm test:e2e` runs the Playwright end-to-end tests against Docker Compose.
- Before a task is done, `pnpm check` and `pnpm sonar` must both pass. Run `pnpm test:e2e` too when the change touches the Conversation flow, auth or the Agent.
- If SonarQube is down, run `pnpm sonar:up`. If the token is rejected, run `pnpm sonar:setup`.
- Never mark a Security Hotspot as safe. Report new ones to the human and stop.
- The pre-commit hook (lefthook) runs Prettier, ESLint and typecheck on staged files.

## MCP servers

`.mcp.json` configures context7 (library docs), livekit-docs (LiveKit's docs, code search and changelog), playwright and chrome-devtools (browser), github (read-only) and dbhub (read-only Postgres). It only holds `${VAR}` references. Keep real values, such as `GITHUB_PERSONAL_ACCESS_TOKEN` and `DBHUB_DSN`, in the git-ignored `.claude/settings.local.json`, and never write a secret into a committed file.
