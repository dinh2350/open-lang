# 19: Delete expired refresh tokens

**What to build:** Ticket 08 found that refresh-token rows are never deleted, so the table only grows. Remove rows that are both expired and revoked, keeping enough history for reuse detection to work.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Expired and revoked refresh tokens are deleted on a schedule or during rotation; reuse detection still works (S1).
- [ ] Definition of done: `pnpm check` and `pnpm sonar` pass.
