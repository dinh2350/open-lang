# 12: A Locked User can't start a Conversation with a cached Room Token

**What to build:** Code review (Spec finding 2, high) confirmed a spec violation. The Conversation page's `TokenSource.custom` caches the Room Token, and `useSession` fetches and caches a fresh one after every End or disconnect. So a User locked after the page loaded, or after any earlier Conversation, can still start one Conversation within the token's 10-minute TTL. The glossary says a Locked User "can't ... start a new Conversation". Fetch a fresh Room Token only when Start is pressed, and never reuse one.

**Blocked by:** 11 (Conversation tests go through the whole app, signed in)

**Status:** ready-for-agent

- [ ] A Room Token is requested only when the User presses Start; no token is prefetched or reused.
- [ ] S3: a User locked after the page loads presses Start and sees the account-locked message.
- [ ] S3: a User locked between two Conversations can't start the second one.
- [ ] Definition of done: `pnpm check`, `pnpm sonar` and `test:e2e` pass.
