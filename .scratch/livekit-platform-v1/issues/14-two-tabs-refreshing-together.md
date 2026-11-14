# 14: Two tabs refreshing together don't sign the User out

**What to build:** Ticket 08 and code review (finding 9) found that two tabs refreshing at the same moment count as refresh-token reuse, which signs the User out everywhere. That happens whenever a User reloads two tabs together. Serialize refresh across tabs in the frontend with the Web Locks API (`navigator.locks`), so the second tab uses the cookie the first one just rotated. Keep reuse detection on the server unchanged.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Refresh calls are serialized across tabs of the same browser.
- [ ] A test shows two concurrent refreshes in one browser both succeed (S3, or S4 with two pages).
- [ ] Server-side reuse detection still revokes all refresh tokens on genuine reuse (S1 unchanged).
- [ ] Definition of done: `pnpm check`, `pnpm sonar` and `test:e2e` pass.
