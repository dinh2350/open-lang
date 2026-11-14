# 11: Conversation tests go through the whole app, signed in

**What to build:** Code review (Standards finding 2) found that the Conversation page tests render the page on its own, without signing in. They rely on a test-only `signedOut` default auth context whose `authorizedFetch` is plain `fetch`, and the MSW fake backend hands out Room Tokens without an Auth Token. So no test would fail if the Bearer header went missing. Move these tests onto seam S3 as the spec defines it: the whole app rendered at a route, with a signed-in User. Unfinished work toward this is on branch `wip/code-review-s3-tests` (never merged; it skipped the pre-commit hooks). Start from it or discard it.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Conversation page tests render the whole app at `/` with a signed-in User.
- [ ] The test-only `signedOut` default context is gone from production code.
- [ ] The MSW fake backend returns `401` for `/api/token` without a valid Auth Token, and a test proves that a missing Bearer header fails.
- [ ] Definition of done: `pnpm check`, `pnpm sonar` and `test:e2e` pass.
