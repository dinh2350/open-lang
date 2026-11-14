# 03: Talk with the Agent in Realtime mode (OpenAI)

**What to build:** A developer sets the Agent Mode to Realtime with the OpenAI Provider and an OpenAI key. A person presses Start and the Agent greets them first with "Hello, how can I help?". The person and the Agent then talk naturally in English. The Conversation page shows whether the Agent is listening, thinking or speaking, shows a visualizer that moves with the Agent's voice, and lets the person mute their microphone. This slice introduces the Agent's config module, which is seam S2 in the spec. See the spec's Agent and Frontend decisions.

**Blocked by:** 01 (Anonymous Conversation tracer bullet), 02 (SonarQube quality gate)

**Status:** ready-for-agent

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
