# 06: Google Provider for both Agent Modes

**What to build:** A developer can choose Google instead of OpenAI as the Provider for Realtime mode, and for any step in Pipeline mode. Pipeline mode can mix Providers, for example Google speech-to-text with an OpenAI language model. A person can then hold a Conversation with the Agent on Google models. Credentials come from a Gemini API key, or from Vertex AI through environment variables only. See the spec's Agent decisions (Provider mapping) and `docs/research/livekit-node-agents.md` (Google section).

**Blocked by:** 05 (Pipeline mode (OpenAI))

**Status:** ready-for-agent

- [ ] `google` is accepted for `REALTIME_PROVIDER` and for each of `STT_PROVIDER`, `LLM_PROVIDER` and `TTS_PROVIDER`.
- [ ] The factory maps Google to the Google plugin's classes:
  - realtime: `google.realtime.RealtimeModel` (not the deprecated `google.beta.realtime` path);
  - LLM: `google.LLM`;
  - STT: `google.beta.GeminiSTT`;
  - TTS: `google.beta.TTS`.
- [ ] Credentials work two ways:
  - `GOOGLE_API_KEY`;
  - Vertex AI through `GOOGLE_GENAI_USE_VERTEXAI=true` together with `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`.
- [ ] Startup validation requires one of the two credential setups whenever Google is selected.
- [ ] The config module has default Google models for every step that are generally available on the day you implement this.
- [ ] The default TTS model is not `gemini-3.1-flash-tts-preview`, which shuts down on 2026-12-18.
- [ ] The deprecated-model list includes the Google models that are known to be deprecated.
- [ ] S2 tests cover the full matrix: both Agent Modes, every Provider for every step (including mixed Pipeline setups), and both Google credential setups. They use dummy credentials and no network.
- [ ] `test:live` gains Google Realtime and Google Pipeline tests. Each is skipped when Google credentials are absent.
- [ ] Manual check: a person can hold a spoken Conversation with Google in Realtime mode and in Pipeline mode.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.
