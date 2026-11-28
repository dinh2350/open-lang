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
- `src/conversation-agent.ts`: the job module. The CLI loads it in each job process; its default export is the `defineAgent` entry that runs one Conversation in one `AgentSession`. It reads the job's metadata for the learner brief only (`parseLearnerBrief` from `@open-lang/shared`) and gives it to the tutor; metadata that is missing, invalid or without items is no brief, and the Conversation is then the same lesson as ever. The job ends as soon as its session closes (when the User leaves, for example); its shutdown callback then waits for the transcript and the Notes still being sent, then posts the end marker, which tells the backend the Report may be written. Text the User types is handled as the SDK does by default.
- `src/tutor-instructions.ts`: `tutorInstructions(order, brief?)`, the tutor's instructions with `saveNote` called after it speaks or before it (see "Gemini Live and tool calls"), then the lines of the learner brief when there is one, its opening line and the instruction to say it.
- `src/learner-brief.ts`: `learnerBriefInstructions(brief)`, the lines that tell the tutor what the User has already studied (see "Learner brief").
- `src/agent.ts`: the `TutorAgent` class, an English tutor that explains in Vietnamese, with the tools it is given, the note order it is given and the learner brief it is given.
- `src/note-tool.ts`: `createSaveNoteTool`, the `saveNote` tool, which validates a Note and sends it to the backend.
- `src/transcript-recorder.ts`: `recordTranscript`, which sends each user and assistant message to the backend, in order, timed by the speaking intervals of LiveKit's state events.
- `src/backend-client.ts`: `createBackendClient`, which posts turns, Notes and the end marker to the backend with `AGENT_API_KEY`, retries, and never rejects; `trackPendingSends`, which lets the job wait for the sends it started.
- `src/config/`: the validated environment, the models and the `AgentSession` options.
- `test/`: unit and integration tests. `test/live/` needs real Provider keys and runs with `pnpm test:live`.

## Notes and missed sentences

While it teaches, the tutor writes down what the User should review, with the `saveNote` tool (`src/note-tool.ts`): a `phrase`, a `word`, a `correction` (the User's wrong sentence and its fix) or a `missed` sentence. The tool checks the Note with the shared schema and sends it to the backend under the Conversation's room. An invalid Note goes back to the model as an error, and a backend that is down only costs the Note. The Conversation always starts with `OPENING_LINE` (`Chào bạn! Hôm nay bạn muốn học gì?`), which `startConversation` tells the model to say word for word.

There is no "Chưa nghe kịp" button and no Scenario: the tutor finds a missed sentence from the talk itself, as its instructions say (`src/tutor-instructions.ts`). When the User's reply is off-topic or does not answer, or the User says they could not hear or catch the sentence, the tutor says it again in English, simpler and slower, and saves a `missed` Note holding that sentence and its Vietnamese meaning. When the User only asks it to repeat or to speak slower, it says it again, slower, and that is not a missed sentence: it saves no Note for it. The OpenAI realtime model's speech speed is fixed at 1 in `src/config/session-options.ts` and Gemini has no speed setting: the User asks for slower speech by voice. To change when a sentence counts as missed, change the instructions and their live checks, not code that watches the transcript.

**Gemini Live and tool calls.** Gemini Live (Realtime mode with Google, on the Gemini API) needs two settings, found by watching a real lesson: its tools are declared `NON_BLOCKING` (`src/config/session-options.ts`) and the tutor calls `saveNote` before it speaks (`noteOrderOf`, `src/tutor-instructions.ts`). The Node.js plugin leaves tools `BLOCKING`, unlike the Python one. A blocking call makes Gemini stop its turn and start a new one by itself once the result is in; the SDK takes that for the User speaking and cuts the tutor off, and the plugin closes the microphone while a call is unanswered, so the lesson went silent after the first note. Even `NON_BLOCKING`, the plugin ends the tutor's turn at the call and takes the end of that same turn for a new turn: a call made after the tutor has spoken cuts off its audio, which Gemini generates in a fraction of a second but which plays for seconds (the saved transcript showed only the first words of such a reply, `Chính xác! Từ`). A call made first has no audio to cut. Every other model speaks first and calls after (`after-speaking`), which is why the order depends on the model. The `saveNote` tool also drops a `said` that is not on a correction, which Gemini often sends and which would otherwise refuse the note and trigger another reply.

The tutor saves the other kinds by itself too. It saves a `correction` when it corrects the User (what the User said, the better sentence, the reason in Vietnamese), a `phrase` when the User has practised an English model sentence it taught (the sentence and its Vietnamese meaning), and a `word` when it teaches a new useful word or expression (the word and its Vietnamese meaning). It never saves the same thing twice, and the Notes stay few: only what is worth keeping, a few per topic.

## Learner brief

Each Conversation is dispatched with a learner brief in the job's metadata: what the User keeps from their Notes, as items with their English, their Vietnamese meaning and a status, `learning` or `mastered`. The backend builds it, `@open-lang/shared` holds its schema, and the job parses it with `parseLearnerBrief`. `learnerBriefInstructions` (`src/learner-brief.ts`) turns it into the last lines of the tutor's instructions: the list, one item per line, then the rules. The tutor does not read the list aloud, does not teach a `mastered` item as new (it confirms it briefly and moves on when the User brings it up), may review a `learning` item briefly when it fits but never teaches it from scratch, prefers something the User has not studied yet, and saves no note for an item in the list unless it taught it again. The text of an item comes from the User's Notes, so each item stays on one line and cannot become a line of instructions. Without a brief, or with a brief without items, there are no such lines, and the tutor is the one it was before the brief existed.

The brief changes the tutor only through its instructions: no code watches the transcript or the Notes against the list. To change what the tutor does with the brief, change the lines and their checks (`learnerBriefChecks` in `test/live/tutor-checks.ts`), not code around them. The job logs only how many items the brief has, never the items.

The live checks of the brief (the tutor does not teach a mastered item as new, and does not read the list aloud) have been written but not yet run against a real Provider, so do not take them as proven. This sentence goes when they have run.

Open question for the human: the rule "Do not save a note for an item in the list unless you taught it again" could also keep the tutor from saving a `correction` note when the User gets a listed item wrong, and that correction is worth keeping. The rule is unchanged; no check covers this case yet.

## LiveKit Inference is never used

LiveKit's docs and starter use `inference.STT`, `inference.TTS` and `inference.LLM`. This repo does not use LiveKit Inference at all, and `test/no-livekit-inference.spec.ts` enforces it. When a docs example uses `inference.*`, replace it with the Provider plugins wired in `src/config/session-options.ts`.

## Testing

Test the Agent through an `AgentSession` and `session.run(...)`, as LiveKit's [testing docs](https://docs.livekit.io/testing/unit-tests/) describe, with the fake Provider and the test doubles in `test/`. Do not assert on private state.

When you change the Agent's instructions, tools or workflow, write the test for the wanted behavior first, then change the Agent until it passes.

`test/live/` holds the live checks of the tutor's behavior: it opens in Vietnamese, teaches an English sentence and saves a `phrase` Note, speaks slower when asked, saves a `missed` Note after an off-topic reply, and, started with a learner brief, does not teach a mastered item as new nor read the list aloud (`liveTutor(target)` returns a function that starts the tutor with the brief a check gives). They talk to a real Provider, so `pnpm test:live` runs them, never `pnpm test`. They judge what the tutor does, not its exact words, and the fake backend in `test/fake-backend.ts` receives its Notes.

LiveKit simulations run the tutor's scenarios in `scenarios.yaml` against the Agent with `lk agent simulate text --scenarios apps/agent/scenarios.yaml` (needs the `lk` CLI 2.19.0 or later, LiveKit Cloud credentials and a real Provider). The Agent runs without job metadata (it then has no learner brief), so the simulator can dispatch it as it is. Read the [simulations documentation](https://docs.livekit.io/testing/simulations/) before editing the scenarios.

## Workflows

Voice agents are sensitive to latency. Keep irrelevant context and tools out of each LLM request. For a multi-phase conversation, use handoffs between Agents instead of one long instruction prompt. See the [workflows documentation](https://docs.livekit.io/agents/logic/workflows/).

## Node.js and Python

The Node.js SDK has most, but not all, of the Python SDK's features. Check the documentation for availability before using a feature, and avoid ones the Node.js SDK does not support.
