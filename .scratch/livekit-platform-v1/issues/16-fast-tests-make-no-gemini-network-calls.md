# 16: Fast tests make no Gemini network calls

**What to build:** While `pnpm check` ran on the integration branch, the Google plugin logged `Gemini Live session error: WebSocket closed with code 1006` from inside the fast test run. So at least one fast Agent test opens a real Gemini Live WebSocket. `CODING_STANDARDS.md` says fast tests never need provider keys, and the spec says S2 uses no network.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Find the fast test that starts a Google realtime session and keep it off the network: assert through the factory, or use the `fake` Provider.
- [ ] A fast test run with networking disabled logs no Provider connection errors.
- [ ] Definition of done: `pnpm check` and `pnpm sonar` pass.
