# 15: Standards cleanups from code review

**What to build:** Remaining Standards findings from the code review of the integration branch. None of them change behavior.

**Blocked by:** 11 (Conversation tests go through the whole app, signed in)

**Status:** ready-for-agent

- [ ] Finding 10: rename the `session` variable on the Conversation page to `conversation`, as the glossary rule in `CODING_STANDARDS.md` requires. Library names stay.
- [ ] Finding 12: `credentials-form.tsx` uses the shared register and sign-in request type instead of its own `Credentials` interface.
- [ ] Finding 14: one refusal-parsing helper for `auth-api.ts` and `users-api.ts`, one `errorMessage`, `MINIMUM_PASSWORD_LENGTH` instead of the hard-coded text in `users-page.tsx`, and `shared/src/admin-users.ts` reuses the password rule from `auth.ts`.
- [ ] Finding 19: `e2e/playwright.config.ts` reads LiveKit keys and the database password from an env file with a committed `e2e/.env.example`.
- [ ] Definition of done: `pnpm check`, `pnpm sonar` and `test:e2e` pass.
