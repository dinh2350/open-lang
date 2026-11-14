# 17: Upgrade to ESLint 10

**What to build:** Ticket 01 found that npm marks ESLint 9 as unsupported. Upgrade to ESLint 10 once `typescript-eslint`, `eslint-plugin-sonarjs`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` and the Vitest plugin support it. If any of them doesn't yet, record which ones under `## Comments` and stop.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] ESLint 10 runs with the same rule set; no rule is dropped or loosened.
- [ ] Definition of done: `pnpm check` passes with zero warnings and `pnpm sonar` passes.
