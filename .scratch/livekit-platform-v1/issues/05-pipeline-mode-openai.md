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

## Comments

### 2026-11-14, implementer (branch `ticket/05-pipeline-openai`)

**Result.** `AGENT_MODE=pipeline` works with `openai` or `fake` for each step. After merging the integration tip (tickets 08 and 09, 2e54d95):

- `pnpm check` passes (225 tests).
- `pnpm sonar` passes the gate: coverage 95.5% (lines 96.2%, branches 93.4%), duplication 0.0%, A ratings, 0 issues. Every file under `agent/src` has 100% coverage except the entrypoint `main.ts`, as before.
- `pnpm test:e2e` passes both tests. S4 still uses Realtime mode with the `fake` Provider.
- `pnpm test:live` skips both live tests and exits 0, because there is no key.

Two first runs failed on host load (load average 14 on 12 cores), and both reruns passed:

- `test:e2e`: the agent server registered but never received the job, the known load-threshold flake.
- `pnpm sonar`: Testcontainers timed out waiting for Docker to bind ports, before any test ran.

**Security Hotspots: none.** SonarQube reported 0.

**Manual check: not done.** There is no OpenAI key here, so neither live test has ever run against OpenAI. A human needs to do two things:

1. Run the live tier: set `OPENAI_API_KEY` in `agent/.env`, then run `pnpm test:live`.
2. Talk to the Agent: set `AGENT_MODE=pipeline` and `STT_PROVIDER`, `LLM_PROVIDER` and `TTS_PROVIDER` to `openai`. Then run `pnpm dev`, open http://localhost:5173, press Start and talk.

**Needs a human decision: OpenAI has no text-to-speech model that isn't deprecated.**

- OpenAI deprecated every Speech API (`v1/audio/speech`) model: `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`, `gpt-4o-mini-tts-2025-03-20` and `gpt-4o-mini-tts-2025-12-15`. All of them shut down on **2027-01-06**.
- OpenAI's named replacement is `gpt-realtime-2.1-mini` on the Realtime API. Its text-to-speech guide says that model "isn't a supported model for `/v1/audio/speech`".
- The Node plugin's `openai.TTS` can only call the Speech API. No version of the plugin offers a Realtime-based TTS. The npm `2.0.0` release is a mislabeled old build that peers on `@livekit/agents` 1.1.0, and it also uses `audio.speech`.
- I chose **`gpt-4o-mini-tts`** as the default and left it, with its snapshots, **off** the deprecated-model list. Without that exception, Pipeline mode couldn't speak with OpenAI at all. `tts-1` and `tts-1-hd` are rejected, with `gpt-4o-mini-tts` as the suggested replacement. The exception is commented in `agent/src/config/models.ts`.
- The options before 2027-01-06:
  - (a) Accept that OpenAI TTS stops working on that date.
  - (b) Write our own TTS on the Realtime API.
  - (c) Use Google TTS from ticket 06.

**Default OpenAI models** (all read 2026-11-14):

- **STT: `gpt-live-transcribe`.**
  - The models page (https://developers.openai.com/api/docs/models) lists it as "Low-latency speech-to-text model for realtime transcription", with no Preview label.
  - The Realtime transcription guide (https://developers.openai.com/api/docs/guides/realtime-transcription) says "Start with gpt-live-transcribe".
  - The deprecations page (https://developers.openai.com/api/docs/deprecations) names it as the replacement for `whisper-1`, `gpt-4o-transcribe` and `gpt-4o-mini-transcribe` (shutdown 2027-02-26).
  - Not chosen: the plugin default `gpt-realtime-whisper`, which OpenAI's Whisper migration cookbook moves to `gpt-live-transcribe`. Also not chosen: `gpt-transcribe`, which transcribes per committed turn rather than live.
- **LLM: `gpt-6-luna`.**
  - Its model page (https://developers.openai.com/api/docs/models/gpt-6-luna) calls it "Our most efficient model for focused, high-volume tasks". It supports Chat Completions and costs $0.10 / $0.50 per 1M tokens.
  - The deprecations page names it as the replacement for the plugin default `gpt-4.1`, and for `gpt-4o`, `gpt-4o-mini` and `gpt-4.1-mini` (shutdown 2027-01-14).
  - The alternative is `gpt-6.1-terra`, "a fast, efficient model" at $1 / $5. Say if you prefer it.
- **TTS: `gpt-4o-mini-tts`** with the voice `marin`. See the decision above. The text-to-speech guide (https://developers.openai.com/api/docs/guides/text-to-speech) recommends marin or cedar. Marin is also the Realtime voice, so both Agent Modes sound alike.

**Realtime input transcription.** Realtime mode now transcribes the User with `gpt-live-transcribe` instead of the plugin's deprecated `gpt-4o-mini-transcribe`. The Realtime API reference (https://developers.openai.com/api/reference/resources/realtime/subresources/sessions/methods/create) lists it among the `audio.input.transcription.model` options. This was never tried with a key. If OpenAI rejects it, only the User's transcript is lost; there is no transcript UI. The S2 test reads the plugin's `_options`, because the plugin has no public getter for it. `gpt-4o-mini-transcribe` is now on the deprecated-model list, and `STT_MODEL=gpt-4o-mini-transcribe` fails, which an S2 test checks.

**Decisions for review:**

1. **Variables.** Pipeline mode requires `STT_PROVIDER`, `LLM_PROVIDER` and `TTS_PROVIDER`. `STT_MODEL`, `LLM_MODEL` and `TTS_MODEL` are optional.
   - I added `TTS_VOICE`, which defaults to `marin`. It is the spec's "optional voice settings per Provider", but it is not in the ticket.
   - An empty variable counts as unset.
   - `OPENAI_API_KEY` is required whenever any step uses `openai`. Each such step adds its own error line, for example `OPENAI_API_KEY is required when STT_PROVIDER is "openai"`.
   - All bad steps are reported at once.
   - `AGENT_MODE` errors now read `AGENT_MODE must be "realtime" or "pipeline"`.
2. **The `fake` Provider per step.** `voice.testing` has only `FakeLLM`. So a fake LLM is `FakeLLM`, and a fake STT or TTS is no model at all: the Agent hears nothing, or its replies stay text. The log names their model `none`.
3. **Silero VAD** is the framework's bundled `inference.VAD({ model: 'silero' })`, run locally by `@livekit/local-inference`. AgentSession uses the same one by default. I didn't add `@livekit/agents-plugin-silero`, which would bring in `onnxruntime-node`. Despite the `inference` namespace, it never calls LiveKit Inference. The same VAD is passed to `openai.STT`: `gpt-live-transcribe` needs a VAD to commit each turn, and without one the plugin builds a second VAD.
4. **Turn detection** is `inference.TurnDetector({ version: 'v1-mini' })`. It is pinned because, left unset, the detector picks the cloud `v1` model in dev mode. The agent server registers the local turn-detection runner in both `dev` and `start`.
5. **Reasoning off.** `openai.LLM` always sends `reasoning_effort: "none"`. The gpt-6 models default to `medium`, which delays every spoken reply. The plugin turns reasoning off only for models up to gpt-5.6. On Chat Completions, `gpt-6-luna` also calls tools only with `none`, and the live `judge()` needs tool calls. An S2 test checks the request body through a stubbed `fetch`. A model that doesn't support `reasoning_effort` would reject the request; every non-deprecated model I checked accepts `none`.
6. **Greeting test** (`agent/test/greeting.spec.ts`).
   - `FakeLLM` can't answer the greeting instructions (see ticket 03). So the test injects a `FakeLLM` into a Pipeline session and reads its first request: it holds only the system message, which ends with the "Hello, how can I help?" instruction.
   - I checked that the test fails when the greeting instructions change.
   - "Models as parameters" means `startConversation(session)` takes a session that the caller builds.
7. **Live Pipeline test** (`agent/test/live/pipeline-openai.spec.ts`).
   - `session.run()` can't capture a greeting that `startConversation` starts. So the greeting is judged through a `voice.testing.MessageAssert` built around it; both constructors are public.
   - The answer goes through `session.run()`.
   - The judge is the Agent's own `gpt-6-luna`.
   - Unverified: `judge()` sends `temperature: 0`, and I don't know whether gpt-6-luna accepts it.
   - The test runs without a room, so STT and TTS are covered only by the manual check.
8. **Deprecated-model list.**
   - Added: OpenAI's STT models; `tts-1` and `tts-1-hd`; and chat models shut down since 2026-07-23 or announced for shutdown. I left out the coding, search, research and `-codex` models.
   - Deviation: the aliases `gpt-4o`, `gpt-4o-mini`, `gpt-4.1` and `gpt-4.1-mini` are listed, though OpenAI lists only their dated snapshots.
   - Deviation: OpenAI names `gpt-4o-mini-transcribe-2025-12-15` as the replacement for `gpt-4o-mini-transcribe-2025-03-20`, but it is itself deprecated. The error suggests `gpt-live-transcribe` instead.
9. **Factory structure** (`agent/src/config/session-options.ts`, for ticket 06). `createSessionOptions` sends Realtime and Pipeline configs to separate functions. In Pipeline mode, `speechToText`, `languageModel` and `textToSpeech` each choose by Provider. In `agent-config.ts`, each step is a zod discriminated union on its Provider variable. The three unions are intersected and parsed inside the `pipeline` option's transform, because zod rejects an intersection as a discriminated-union option.
10. **Outside the Agent package:** one sentence in `README.md` says how to switch to Pipeline mode.

**Open issues:**

- **OpenAI TTS shuts down on 2027-01-06** (see above).
- A Pipeline step with the `fake` STT still runs Silero and turn detection on the User's audio. This is harmless but uses CPU.
- `test:live` can't check speech-to-text or text-to-speech, because it runs without a room.
