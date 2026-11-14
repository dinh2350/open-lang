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

## Comments

### 2026-11-14, implementer (branch `ticket/06-google-provider`)

**Result.** `google` works for `REALTIME_PROVIDER` and for each Pipeline step, with a Gemini API key or with Vertex AI. Pipeline steps can mix OpenAI, Google and `fake` freely. After merging the integration tip (ticket 10, edab68f):

- `pnpm check` passes (332 tests).
- `pnpm sonar` passes the gate: coverage 96.2% (lines 96.8%, branches 94.8%), duplication 0.0%, A ratings, 0 issues. `agent/src/config` has 100% line and branch coverage.
- `pnpm test:e2e` passes both tests on the first run, at load average 16. S4 still uses Realtime mode with the `fake` Provider.
- `pnpm test:live` skips all four live tests and exits 0, because there are no Google or OpenAI credentials here.

**Security Hotspots: none.** SonarQube reported 0.

**Manual check: not done.** There are no Google credentials here, so the Google live tests have never run either. A human needs to do two things:

1. Run the live tier. Set `GOOGLE_API_KEY` in `agent/.env`, then run `pnpm test:live`. For Vertex AI instead, set `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION=us`, and sign in with `gcloud auth application-default login`.
2. Talk to the Agent. Set `REALTIME_PROVIDER=google`, run `pnpm dev`, open http://localhost:5173, press Start and talk. Then set `AGENT_MODE=pipeline` with `STT_PROVIDER`, `LLM_PROVIDER` and `TTS_PROVIDER` set to `google`, and talk again.

**Default Google models** (all read 2026-11-14):

- **Realtime: `gemini-3.8-live`, voice `Kore`.**
  - The Gemini API changelog (https://aistudio.google.com/docs/changelog) says "Gemini 3.8 Live ... generally available (GA)" on 2026-09-15. The deprecations page (https://aistudio.google.com/docs/deprecations) announces no shutdown, and names it as the replacement for every older Live model.
  - Vertex AI's model versions page (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions) lists it as GA, released 2026-09-24, retiring 2027-09-25 or later, under the same name. Its model page (https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-live) serves it in `us`, `eu` and `us-central1`.
  - Not chosen: the plugin's defaults. On the Gemini API that is `gemini-2.5-flash-native-audio-preview-12-2025`, a Preview shutting down on 2027-03-31. On Vertex AI it is `gemini-live-2.5-flash-native-audio`, which retires on 2026-12-13. Also not chosen: `gemini-3.8-live-extended-thinking`, the variant with extended thinking.
- **STT: `gemini-3.5-transcribe-live`.**
  - The changelog says "Gemini 3.5 Transcribe generally available (GA)" on 2026-08-26. The live variant is part of that entry, but has no GA label of its own. The deprecations page's Live API table lists it with no shutdown.
  - Vertex AI's model page (https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-transcribe) serves the same name in `global`, `us` and `eu`, and states no launch stage.
  - It is also the plugin's default.
- **LLM: `gemini-3.8-flash`.**
  - The models page (https://aistudio.google.com/docs/models) marks it "Stable"; the changelog says GA on 2026-09-02. Vertex AI lists it as GA, retiring 2027-09-02 or later, served in `global`, `us` and `eu`.
  - Not chosen: the Gemini 4 models, GA since October and November. Their thinking can't go below `low` either, and Vertex AI gives `gemini-4-carbon` and `gemini-4-hydrogen` "shorter availability". Say if you prefer `gemini-4-argon`.
- **TTS: `gemini-3.8-flash-lite-tts`, voice `Kore`.**
  - The changelog says GA on 2026-09-22, and that it was "built to replace `gemini-3.1-flash-tts-preview`" for production. The speech generation guide (https://aistudio.google.com/docs/speech-generation) recommends Flash-Lite for "conversational voice agent cascades", and `gemini-3.8-flash-tts` where "maximum acoustic fidelity" matters most.
  - Vertex AI's guide (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/speech/text-to-speech) serves the same name in `global`, `us` and `eu`, and states no launch stage.
  - It is not `gemini-3.1-flash-tts-preview`, the plugin's default, which shuts down on 2026-12-18. That model is now on the deprecated-model list.
- **Voice `Kore`** is the plugin's TTS default, and one of the 30 prebuilt voices that both the Live API and TTS accept. Both Agent Modes use it, so they sound alike; the plugin's realtime default is `Puck`.

**Decisions for review:**

1. **Credentials.** `GOOGLE_GENAI_USE_VERTEXAI` chooses between the two setups, as in Google's SDK.
   - `true`: Vertex AI. `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` are required. Vertex AI wins when `GOOGLE_API_KEY` is set too, as in Google's SDK.
   - Unset, empty or `false`: the Gemini API. `GOOGLE_API_KEY` is required.
   - Any other value, such as `1` or `TRUE`, fails with `GOOGLE_GENAI_USE_VERTEXAI must be "true" or "false"`. Google's SDK also accepts `1`, but the plugin's TTS doesn't.
   - The Google variables are checked only when a Google Provider is selected. Each step that uses Google adds its own error line, for example `GOOGLE_API_KEY is required when TTS_PROVIDER is "google", unless GOOGLE_GENAI_USE_VERTEXAI is "true"`.
   - Vertex AI signs in with Google's Application Default Credentials. The config doesn't check them; a missing sign-in fails at the first request.
2. **Credentials are passed explicitly** to every plugin class (`apiKey`, or `vertexai`, `project` and `location`) instead of each class reading the environment. The classes read it inconsistently: the TTS takes only `true`, the STT defaults the location to `global`, and the others default it to `us-central1`.
3. **Vertex AI location.** `agent/.env.example` sets `GOOGLE_CLOUD_LOCATION=us`, the one location that serves all four default models. `global` doesn't serve `gemini-3.8-live`, and `us-central1` doesn't serve the Flash, TTS or transcription models. The Gemini API ignores the variable.
4. **Realtime turn handling** is the same as OpenAI's: Google's server detects when the User has finished (`turnDetection: 'realtime_llm'`, no local VAD). The plugin's input and output transcription stay at their defaults. In Pipeline mode, Gemini STT takes no VAD option; Silero still runs for the turn detector.
5. **The Google LLM thinks at `low`.** `gemini-3.8-flash` thinks at `medium` unless told otherwise, which delays every spoken reply, and doesn't support `minimal` (https://aistudio.google.com/docs/thinking). Google describes `low` as suited to "fast chat". An S2 test checks the request body, URL and API key through a stubbed `fetch`.
   - To type the level, `@google/genai` is now a direct dependency, at 2.32.0, the version the plugin already uses.
   - Caveat: an `LLM_MODEL` that rejects `low` fails. For example, Gemma 4 models take only `minimal` or `high`. Gemini 2.5 models ignore the level with a warning.
6. **Deprecated-model list.** Google's entries come from the Gemini API's deprecations page and Vertex AI's model versions page. Only chat, Live API and speech models are listed, not image, embedding, video, music, robotics or agent models. The check doesn't know which Google API the Agent uses, so a model that either API deprecated is rejected, with the earlier shutdown date.
   - **Needs a human decision:** three models differ between the two APIs, and are now rejected on both:
     - `gemini-2.5-flash-lite`: Vertex AI retired it on 2026-10-20; the Gemini API serves it "until further notice".
     - `gemini-3.6-flash`: "Stable" on the Gemini API; Vertex AI retires it on 2026-11-19.
     - `gemini-3.5-flash`: the Gemini API has routed it to `gemini-3.6-flash` since 2026-10-08; Vertex AI serves it until 2027-05-19 at least.
     The alternative is a check per API, which has to run after the credentials are parsed.
   - Deviations from the replacements Google names: where Google names a model that is itself deprecated on either API, the error suggests a model that is GA on both. So `gemini-3.6-flash` becomes `gemini-3.8-flash`, and `gemini-3.1-flash-lite` becomes `gemini-3.5-flash-lite`. For the deprecated TTS models Google names two models; the error suggests the default, `gemini-3.8-flash-lite-tts`.
   - Not listed, because neither page announces a shutdown: `gemini-3.1-flash-live-preview` (a "legacy" Preview with a named replacement), `gemini-3-flash-preview`, and the Vertex AI TTS names `gemini-2.5-flash-tts` and `gemini-2.5-pro-tts` from the plugin's types.
7. **The list is now a table, one row per model.** Adding Google's entries made SonarQube count the repeated `{ shutdown, replacement, models }` object shape as 3.2% duplicated lines, over the gate's 3%. The list is data, so it became a table: model, shutdown and replacement, with notes on `#` lines, as Google's deprecations page lays it out. The 93 models, dates and replacements didn't change, and no Sonar configuration changed.
8. **Live tests.** `agent/test/live/realtime-google.spec.ts` and `pipeline-google.spec.ts` mirror the OpenAI ones. Each is skipped unless `GOOGLE_API_KEY` is set or `GOOGLE_GENAI_USE_VERTEXAI` is `true`. The Pipeline judge is the Agent's own `gemini-3.8-flash`. Unverified: whether Gemini 3.8 Live says the greeting's exact words, which the Realtime test expects.
9. **S2 coverage.** `agent/test/google-provider.spec.ts` covers the defaults, both credential setups, every validation failure, Google's deprecated models, and the plugin classes built.
   - Vertex AI's project and location are checked through the public `provider` and `opts` getters, and the realtime model's `_options`, which has no public getter (as in ticket 05).
   - The matrix in `pipeline-config.spec.ts` now builds all 27 Provider mixes once per credential setup.
   - OpenAI STT and LLM with Google TTS has its own tests: defaults, plugin classes, and an error naming only `TTS_PROVIDER` when the Google key is missing.
   - Gap: `google.beta.GeminiSTT` exposes no credentials and creates its client only when it streams, so S2 can't see which credentials it got. Only the factory code and the live test cover that.
10. **Outside the Agent package:** the README's Agent paragraph (still one line) now mentions Google and mixed Providers; the lockfile; and one line in `pnpm-workspace.yaml`. That line adds `@google/genai` to `ignoredBuiltDependencies`, because its only install script is a no-op `echo`, like the other entries there. Without it, every `pnpm install` warns. This is one line more than my brief allowed.

**Open issues:**

- **The OpenAI TTS decision from ticket 05 is unchanged.** Option (c) now works: `TTS_PROVIDER=google` with OpenAI for STT and LLM is tested in S2.
- Neither credential setup has ever run against Google.
