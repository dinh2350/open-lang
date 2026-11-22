# open-live-agent

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Quality gates

Read `CODING_STANDARDS.md` before writing code. Fix the code, never the scanner: no `NOSONAR`, `@ts-ignore`, exclusions or lowered thresholds without a human's approval.

- After each edit, a hook runs Prettier and `eslint --fix` on the file. Fix every problem it reports.
- Before a ticket is done, `pnpm check` and `pnpm sonar` must both pass. `pnpm sonar` prints each failed condition and every open issue as `file:line  rule  message`; fix them all, even when the gate passes.
- If SonarQube is down, run `pnpm sonar:up`. If the token is rejected, run `pnpm sonar:setup`.
- Never mark a Security Hotspot as safe. List new ones under `## Comments` in the ticket and stop.

Details: `docs/quality-gates.md`.
