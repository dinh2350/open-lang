# 13: Handle failed Room Token refetches and unmute failures

**What to build:** Code review (Spec finding 3) and tickets 03, 04 and 10 found errors that nothing handles. A failed Room Token refetch causes an unhandled rejection after End, after sign-out, and on unmount mid-Conversation (`room-token-source.ts`). An unmute failure is only logged to the console (`microphone-toggle.tsx`). Separately, after a Room Token failure the browser keeps the microphone for up to 15 seconds before `livekit-client` releases it. Ticket 12 may remove the refetch path entirely; handle whatever remains.

**Blocked by:** 12 (A Locked User can't start a Conversation with a cached Room Token)

**Status:** ready-for-agent

- [ ] No unhandled promise rejections after End, sign-out, or leaving the page mid-Conversation (S3).
- [ ] An unmute failure shows a visible message on the Conversation page (S3).
- [ ] After a Room Token failure, the microphone is released straight away.
- [ ] Definition of done: `pnpm check`, `pnpm sonar` and `test:e2e` pass.
