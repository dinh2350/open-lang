# 18: The Agent accepts jobs under CPU load during end-to-end tests

**What to build:** Several implementers saw `test:e2e` fail when the host was busy: the Agent registered but never received a job, because the agent server rejects jobs above its load threshold. Make S4 deterministic, for example by raising the load threshold in the dev and test environment only.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Agent's load threshold is configurable by env, with the production default unchanged.
- [ ] S4 passes while the host is under heavy CPU load (for example, during a parallel `pnpm test`).
- [ ] Definition of done: `pnpm check`, `pnpm sonar` and `test:e2e` pass.
