# 03: Talk with the Agent in Realtime mode (OpenAI)

**What to build:** A developer sets the Agent Mode to Realtime with the OpenAI Provider and an OpenAI key. A person presses Start and the Agent greets them first with "Hello, how can I help?". The person and the Agent then talk naturally in English. The Conversation page shows whether the Agent is listening, thinking or speaking, shows a visualizer that moves with the Agent's voice, and lets the person mute their microphone. This slice introduces the Agent's config module, which is seam S2 in the spec. See the spec's Agent and Frontend decisions.

**Blocked by:** 01 (Anonymous Conversation tracer bullet), 02 (SonarQube quality gate)

**Status:** done

- [ ] The Agent's config module is a pure function from the environment to a validated configuration.
- [ ] Supported variables: `AGENT_MODE` (only `realtime` for now), `REALTIME_PROVIDER` (`openai` or `fake`), `REALTIME_MODEL`, and an optional voice.
- [ ] The config module holds a default OpenAI realtime model. Pick one that is generally available on the day you implement this, not the plugin default.
- [ ] The config module holds a list of known-deprecated models.
- [ ] The Agent fails at startup, with a message naming the bad variable, when:
  - `AGENT_MODE` or the Provider has an unknown value; `pipeline` is reported as not yet supported until ticket 05;
  - `OPENAI_API_KEY` is missing while OpenAI is selected;
  - a configured model is on the deprecated list.
- [ ] A factory turns the configuration into session options. S2 tests assert, with a dummy key and no network, that the factory builds the OpenAI plugin's realtime model for `openai` and the fake for `fake`.
- [ ] S2 tests cover every validation failure above.
- [ ] The Agent uses a short general-purpose English system prompt and has no tools.
- [ ] The Agent greets the User first with "Hello, how can I help?".
- [ ] At session start, the Agent logs the Agent Mode, Provider and model.
- [ ] The `fake` Provider from ticket 01 is now selected through the config module (`REALTIME_PROVIDER=fake`), and the S4 smoke test still passes.
- [ ] The Conversation page shows the Agent's state (listening, thinking, speaking), an audio visualizer, and a mic mute toggle.
- [ ] S3 tests render the page with MSW serving `/api` and a real `livekit-client` Room that never connects. They cover the state display and the mute toggle.
- [ ] The root `test:live` script exists. It runs a live test against OpenAI Realtime that checks the Agent greets first, and it is skipped when `OPENAI_API_KEY` is absent.
- [ ] Manual check: with a real OpenAI key, a person can hold a spoken Conversation with the Agent.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.

## Comments

### 2026-11-14, implementer (branch `ticket/03-realtime-openai`)

**Result.** The Agent's config module (`agent/src/config/`) selects Realtime mode with the OpenAI or `fake` Provider. The Conversation page shows the Agent's state, a visualizer and a mute toggle. After merging tickets 04 and 07: `pnpm check` passes (130 tests). `pnpm sonar` passes the gate: coverage 95.0% (lines 96.5%, branches 90.8%), duplication 0.0%, A ratings, 0 issues. S4 (`pnpm test:e2e`, which now registers a User first) passes with the `fake` Provider selected through the config module. `pnpm test:live` skips cleanly without a key and exits 0.

**Security Hotspots: none.** SonarQube reported 0.

**Manual check: not done.** There is no OpenAI key in this environment, so the live test has never run against OpenAI either. A human needs to set `REALTIME_PROVIDER=openai` and `OPENAI_API_KEY` in `agent/.env`, run `pnpm test:live`, then run `pnpm dev`, open http://localhost:5173, press Start and talk.

**Default OpenAI realtime model: `gpt-realtime-2.1`.** Read 2026-11-14:

- Model page (https://developers.openai.com/api/docs/models/gpt-realtime-2.1): Realtime `v1/realtime` is supported; the default snapshot is `gpt-realtime-2.1`, with configurable reasoning effort.
- Changelog (https://developers.openai.com/api/docs/changelog): "Released GPT-Realtime-2.1" on 2026-07-06. The Realtime API has been GA since 2025-08-28, and the beta API was removed on 2026-05-12. No OpenAI page labels the model Preview. OpenAI doesn't label individual Realtime models "GA"; the only model it calls "generally available" is GPT-Live-1.
- Deprecations page (https://developers.openai.com/api/docs/deprecations): the plugin default `gpt-realtime` shuts down on 2027-01-20, and OpenAI names `gpt-realtime-2.1` as its replacement.
- Not chosen: `gpt-live-1`, OpenAI's "premier model for natural, expressive voice conversations", GA since 2026-09-10. It runs on the separate Live API (`v1/live/sessions`), not `v1/realtime`, so `openai.realtime.RealtimeModel` can't use it; the plugin has a separate `openai.realtime.GPTLiveModel`. **Needs a human decision:** whether to offer GPT-Live later.
- The 1.10 plugin's `RealtimeModels` type lists models only up to `gpt-realtime-2`, but it accepts any string. It sends `reasoning` for any model starting with `gpt-realtime-2`, which includes 2.1. We don't set reasoning.

**Deprecated-model list** (`agent/src/config/models.ts`), copied from the deprecations page: `gpt-4o-realtime-preview-2024-10-01`, `gpt-4o-realtime-preview`, `-2024-12-17`, `-2025-06-03`, `gpt-4o-mini-realtime-preview`, `gpt-realtime-mini-2025-10-06`, `gpt-realtime`, `gpt-realtime-2025-08-28`, `gpt-4o-realtime`, `gpt-realtime-mini`, `gpt-realtime-mini-2025-12-15` and `gpt-4o-mini-realtime`, each with its shutdown date and replacement. One deviation: OpenAI names `gpt-realtime-mini` as the replacement for `gpt-4o-mini-realtime-preview`, but `gpt-realtime-mini` is itself deprecated, so the error suggests `gpt-realtime-2.1-mini`. Only Realtime models are on the list; ticket 05 should add the STT, LLM and TTS models from the same page (for example `tts-1`, `whisper-1`, `gpt-4o-transcribe`).

**Decisions for review:**

1. **Variables.** `AGENT_MODE` and `REALTIME_PROVIDER` are required and have no default. `REALTIME_MODEL` defaults per Provider, and `REALTIME_VOICE` defaults to `marin`, the plugin's default, set explicitly. An empty variable counts as not set. `OPENAI_API_KEY` is required with `openai`. The `fake` Provider ignores `REALTIME_MODEL` and `REALTIME_VOICE`, and logs its model as `fake-llm`. Errors name each bad variable, for example `✖ REALTIME_MODEL "gpt-realtime" is deprecated by its Provider; use "gpt-realtime-2.1" (shutdown: 2027-01-20) → at REALTIME_MODEL`. `main.ts` validates the config before the agent server registers, and each job reads it again.
2. **`agent/.env.example` uses `REALTIME_PROVIDER=fake`**, so `pnpm dev` works for anyone without a key: the Agent joins and stays silent. The README says how to switch to OpenAI. Say if you prefer `openai` as the example.
3. **Realtime session options:** `vad: null` and `turnHandling.turnDetection: 'realtime_llm'`. OpenAI's server-side turn detection (the plugin's default `semantic_vad`) decides when the User has finished. No local Silero VAD and no LiveKit Inference turn detector are created.
4. **Greeting.** `startConversation()` (`agent/src/conversation-agent.ts`) starts the session, which connects the room, then calls `generateReply` with "Greet the user by saying exactly: \"Hello, how can I help?\"", as LiveKit's Node starter does. I first put it in the Agent's `onEnter`, and S4 caught a race. `onEnter` runs while `start()` is still connecting, and RoomIO publishes `lk.agent.state` only while connected. The fake greeting finished before the room connected, so the browser never received a state.
5. **The greeting is tested only in the live tier.** `FakeLLM` answers per-reply instructions only when that line starts with `instructions:`, so it can't stand in for a model following the real greeting. This matches the spec ("Realtime mode has no public fake"). The live test checks that the first Agent message matches `/hello\W+how can i help/i`. It doesn't use `judge()`: the exact phrase is a stricter check, and a judge needs a second, chat model.
6. **`test:live` layout.** The tests live in `agent/test/live/`, with their own Vitest project (`agent/test/live/vitest.config.ts`, not in the root `projects`). The fast `agent` project now excludes `test/live/**`, so `pnpm test` never runs them, even with a key in the shell. The agent script runs Vitest under `node --env-file-if-exists=.env`, like `dev` and `start`. No ESLint, Prettier, TypeScript or SonarQube configuration changed; the live project sits under `agent/test`, which `tsconfig` and `sonar.tests` already cover.
7. **Frontend.** The status reads "The Agent is listening." / "thinking." / "speaking."; every other state shows "Waiting for the Agent…". The visualizer is components-react's `BarVisualizer` on the Agent's audio track, with `role="img"` and the label "The Agent's voice". jsdom has no audio, so S3 checks that the visualizer appears, not that it moves. The mute toggle is a "Mute microphone" button (`aria-pressed` when muted) built on `useTrackToggle`.
8. **S3 harness.** `createUnconnectedRoom()` gains `agentIs(state)` and a fake microphone. `setMicrophoneEnabled` now records whether the microphone is on, `isMicrophoneEnabled` reports it, and the local participant emits `TrackMuted` / `TrackUnmuted`; leaving the room turns it off. `allowMicrophoneAccess()` (ticket 04) restores that fake microphone.
9. **Merges with tickets 04 and 07.** `AgentStatus` takes its state from the page-level `useAgent(session)` instead of calling `useAgent()` itself, because every `useAgent` instance restarts the shared Agent join timer. Ticket 04's fresh-attempt test and S4 now expect "The Agent is listening." instead of "The Agent has joined.". From ticket 07, S4 keeps registering a User before Start, and the README keeps the Postgres setup next to the Agent config note.
10. **New dependency:** `@livekit/agents-plugin-openai` 1.10.0, which matches `@livekit/agents` 1.10.0. Version 2.0.0 exists.

**Open issues:**

- **Deprecated plugin default for input transcription.** The plugin's Realtime session transcribes the User's audio with `gpt-4o-mini-transcribe`, which OpenAI shuts down on 2027-02-26 (replacement `gpt-transcribe` or `gpt-live-transcribe`). `gpt-transcribe`'s model page lists Realtime transcription sessions but not `v1/realtime`, so switching without a key to test it was too risky. A human with a key should decide whether to set `inputAudioTranscription` or turn it off (there is no transcript UI).
- **S4 can flake under heavy CPU load.** One run failed with LiveKit logging `failed to send job request: no servers available`: in `start` (production) mode the agent server declines jobs when host CPU load passes its threshold. Load average was 11.7 on 12 cores, with other worktrees running tests. The rerun passed.
- If unmuting fails (for example, the microphone was unplugged), the error isn't shown on the page; it goes to the console as an unhandled rejection.
