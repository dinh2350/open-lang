# AGENTS.md

This is the Agent of open-lang: a LiveKit Agents (Node.js) voice agent. It follows LiveKit's [Node.js starter](https://github.com/livekit-examples/agent-starter-node), adapted to this monorepo. The root `CLAUDE.md` still applies: its quality gates and workflow come first.

## Tooling

This package uses `pnpm` workspaces. Run `pnpm check` from the repository root before calling a change done.

## LiveKit documentation

Always read the latest LiveKit documentation before using a LiveKit API. Training data goes stale.

- The `livekit-docs` MCP server in `.mcp.json` searches LiveKit's docs, code and changelog. Prefer `get_docs_overview` and `get_pages` to browsing by search, and `docs_search` before `code_search`.
- Without the MCP server, use the LiveKit CLI: `lk docs` (macOS: `brew install livekit-cli`).
- The Context7 library `/websites/livekit_io_agents` also holds the Agents docs.

## File layout

- `src/main.ts`: the process entrypoint. It validates the environment and hands over to the `@livekit/agents` CLI (`cli.runApp`).
- `src/conversation-agent.ts`: the job module. The CLI loads it in each job process; its default export is the `defineAgent` entry that runs one Conversation in one `AgentSession`. It ignores the job's metadata. The job ends as soon as its session closes (when the User leaves, for example); its shutdown callback then waits for the transcript and the Notes still being sent, then posts the end marker, which tells the backend the Report may be written. Text the User types is handled as the SDK does by default.
- `src/tutor-instructions.ts`: the tutor's instructions, its opening line and the instruction to say it.
- `src/agent.ts`: the `TutorAgent` class, an English tutor that explains in Vietnamese, with the tools it is given.
- `src/note-tool.ts`: `createSaveNoteTool`, the `saveNote` tool, which validates a Note and sends it to the backend.
- `src/transcript-recorder.ts`: `recordTranscript`, which sends each user and assistant message to the backend, in order, timed by the speaking intervals of LiveKit's state events.
- `src/backend-client.ts`: `createBackendClient`, which posts turns, Notes and the end marker to the backend with `AGENT_API_KEY`, retries, and never rejects; `trackPendingSends`, which lets the job wait for the sends it started.
- `src/config/`: the validated environment, the models and the `AgentSession` options.
- `test/`: unit and integration tests. `test/live/` needs real Provider keys and runs with `pnpm test:live`.

## Notes and missed sentences

While it teaches, the tutor writes down what the User should review, with the `saveNote` tool (`src/note-tool.ts`): a `phrase`, a `word`, a `correction` (the User's wrong sentence and its fix) or a `missed` sentence. The tool checks the Note with the shared schema and sends it to the backend under the Conversation's room. An invalid Note goes back to the model as an error, and a backend that is down only costs the Note. The Conversation always starts with `OPENING_LINE` (`Chào bạn! Hôm nay bạn muốn học gì?`), which `startConversation` tells the model to say word for word.

There is no "Chưa nghe kịp" button and no Scenario: the tutor finds a missed sentence from the talk itself, as its instructions say (`src/tutor-instructions.ts`). When the User's reply is off-topic or does not answer, or the User says they could not hear or catch the sentence, the tutor says it again in English, simpler and slower, and saves a `missed` Note holding that sentence and its Vietnamese meaning. When the User only asks it to repeat or to speak slower, it says it again, slower, and that is not a missed sentence: it saves no Note for it. The OpenAI realtime model's speech speed is fixed at 1 in `src/config/session-options.ts` and Gemini has no speed setting: the User asks for slower speech by voice. To change when a sentence counts as missed, change the instructions and their live checks, not code that watches the transcript.

The tutor saves the other kinds by itself too. It saves a `correction` when it corrects the User (what the User said, the better sentence, the reason in Vietnamese), a `phrase` when the User has practised an English model sentence it taught (the sentence and its Vietnamese meaning), and a `word` when it teaches a new useful word or expression (the word and its Vietnamese meaning). It never saves the same thing twice, and the Notes stay few: only what is worth keeping, a few per topic.

## LiveKit Inference is never used

LiveKit's docs and starter use `inference.STT`, `inference.TTS` and `inference.LLM`. This repo does not use LiveKit Inference at all, and `test/no-livekit-inference.spec.ts` enforces it. When a docs example uses `inference.*`, replace it with the Provider plugins wired in `src/config/session-options.ts`.

## Testing

Test the Agent through an `AgentSession` and `session.run(...)`, as LiveKit's [testing docs](https://docs.livekit.io/testing/unit-tests/) describe, with the fake Provider and the test doubles in `test/`. Do not assert on private state.

When you change the Agent's instructions, tools or workflow, write the test for the wanted behavior first, then change the Agent until it passes.

`test/live/` holds the live checks of the tutor's behavior: it opens in Vietnamese, teaches an English sentence and saves a `phrase` Note, speaks slower when asked, and saves a `missed` Note after an off-topic reply. They talk to a real Provider, so `pnpm test:live` runs them, never `pnpm test`. They judge what the tutor does, not its exact words, and the fake backend in `test/fake-backend.ts` receives its Notes.

LiveKit simulations run the tutor's scenarios in `scenarios.yaml` against the Agent with `lk agent simulate text --scenarios apps/agent/scenarios.yaml` (needs the `lk` CLI 2.19.0 or later, LiveKit Cloud credentials and a real Provider). The Agent needs no job metadata, so the simulator can dispatch it as it is. Read the [simulations documentation](https://docs.livekit.io/testing/simulations/) before editing the scenarios.

## Workflows

Voice agents are sensitive to latency. Keep irrelevant context and tools out of each LLM request. For a multi-phase conversation, use handoffs between Agents instead of one long instruction prompt. See the [workflows documentation](https://docs.livekit.io/agents/logic/workflows/).

## Node.js and Python

The Node.js SDK has most, but not all, of the Python SDK's features. Check the documentation for availability before using a feature, and avoid ones the Node.js SDK does not support.
