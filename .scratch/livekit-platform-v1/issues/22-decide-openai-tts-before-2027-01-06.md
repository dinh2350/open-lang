# 22: Decide the OpenAI TTS model before 2027-01-06

**What to build:** Ticket 05 and code review (Spec finding 4): OpenAI has deprecated every text-to-speech model the LiveKit plugin can call. The default `gpt-4o-mini-tts` is exempted from the deprecated-model list, but the spec says validation rejects any deprecated model. The replacement, `gpt-realtime-2.1-mini`, runs on the Realtime API, which the plugin's TTS can't use. Options: (a) keep the exemption until shutdown, (b) reject it and default Pipeline TTS to Google, or (c) warn until the shutdown date, then reject.

**Blocked by:** None (can start immediately).

**Status:** needs-triage

- [ ] A human records the choice under `## Comments` before 2027-01-06.
- [ ] Implement it with S2 tests; `pnpm check` and `pnpm sonar` pass.
