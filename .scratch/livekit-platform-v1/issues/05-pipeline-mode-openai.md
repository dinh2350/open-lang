# 05: Pipeline mode (OpenAI)

**What to build:** A developer sets the Agent Mode to Pipeline and chooses OpenAI (or `fake`) separately for each step: speech-to-text, the language model, and text-to-speech. A person then talks to the Agent, which now works by transcribing, thinking and speaking as separate steps. It still greets first. This lets the team compare Pipeline with Realtime without code changes. See the spec's Agent decisions.

**Blocked by:** 03 (Talk with the Agent in Realtime mode (OpenAI))

**Status:** ready-for-agent

- [ ] The config module accepts `AGENT_MODE=pipeline`, with `STT_PROVIDER`, `LLM_PROVIDER` and `TTS_PROVIDER` (each `openai` or `fake`) and `STT_MODEL`, `LLM_MODEL` and `TTS_MODEL`.
- [ ] The config module has default OpenAI models for each step that are generally available on the day you implement this.
- [ ] Pipeline variables get the same startup validation as ticket 03: unknown values, a missing key for a selected Provider, and deprecated models all fail with a message naming the variable.
- [ ] Pipeline mode uses Silero VAD and the local `v1-mini` turn detector. It never uses LiveKit Inference.
- [ ] S2 tests: the factory builds the right plugin classes for every combination of `openai` and `fake` across the three steps, using dummy keys and no network.
- [ ] The Agent receives its models as parameters, so a test can inject `FakeLLM`.
- [ ] A `voice.testing` test using `FakeLLM` asserts that the Agent greets the User first.
- [ ] `test:live` gains a Pipeline test against OpenAI that uses `judge()` to check the greeting and a simple answer. It is skipped when `OPENAI_API_KEY` is absent.
- [ ] Manual check: with a real OpenAI key in Pipeline mode, a person can hold a spoken Conversation with the Agent.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.
