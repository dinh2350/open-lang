# 21: Decide the refresh token lifetime

**What to build:** Code review (Spec finding 5): each rotation gives the refresh token a fresh 7 days, so an active User stays signed in indefinitely. Story 24 says "for up to 7 days". A human must choose: (a) an absolute cap of 7 days from sign-in, matching the story, or (b) a sliding 7 days with an absolute cap such as 30 days. Implementing either is a one-line change plus an S1 test.

**Blocked by:** None (can start immediately).

**Status:** needs-triage

- [ ] A human records the choice under `## Comments`.
- [ ] Implement it with an S1 test; `pnpm check` and `pnpm sonar` pass.
