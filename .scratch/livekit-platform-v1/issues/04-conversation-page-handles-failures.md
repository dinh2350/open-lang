# 04: Conversation page handles failures

**What to build:** When something stops a Conversation from working, the person sees a clear message instead of silence. This covers three cases: they deny microphone access, the Room Token request fails, or the Agent doesn't join in time. In each case they can try Start again. See the spec's Conversation page decisions and user stories 31 and 38.

**Blocked by:** 01 (Anonymous Conversation tracer bullet), 02 (SonarQube quality gate)

**Status:** ready-for-agent

- [ ] Microphone access denied: the page explains how to allow the microphone, and the Conversation doesn't start.
- [ ] Room Token request fails (network error or non-2xx response): the page shows an error and the person can press Start again.
- [ ] The Agent doesn't join within a timeout (default 15 seconds, configurable in the frontend): the page shows an "Agent unavailable" message and the Conversation ends.
- [ ] After any of these failures, pressing Start begins a fresh attempt with a new Room Token.
- [ ] S3 tests cover each failure, using MSW for `/api` and a real `livekit-client` Room that never connects. Simulate microphone denial and the Agent's absence through that Room, not by mocking internal components.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.
