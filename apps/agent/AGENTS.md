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

## LiveKit Inference is never used

LiveKit's docs and starter use `inference.STT`, `inference.TTS` and `inference.LLM`. This repo does not use LiveKit Inference at all, and `test/no-livekit-inference.spec.ts` enforces it. When a docs example uses `inference.*`, replace it with the Provider plugins wired in `src/config/session-options.ts`.

## Testing

Test the Agent through an `AgentSession` and `session.run(...)`, as LiveKit's [testing docs](https://docs.livekit.io/testing/unit-tests/) describe, with the fake Provider and the test doubles in `test/`. Do not assert on private state.

When you change the Agent's instructions, tools or workflow, write the test for the wanted behavior first, then change the Agent until it passes.

LiveKit simulations run scenarios against the Agent with `lk agent simulate text --scenarios apps/agent/scenarios.yaml` (needs the `lk` CLI 2.19.0 or later, LiveKit Cloud credentials and a real Provider). Read the [simulations documentation](https://docs.livekit.io/testing/simulations/) before editing the scenarios.

## Workflows

Voice agents are sensitive to latency. Keep irrelevant context and tools out of each LLM request. For a multi-phase conversation, use handoffs between Agents instead of one long instruction prompt. See the [workflows documentation](https://docs.livekit.io/agents/logic/workflows/).

## Node.js and Python

The Node.js SDK has most, but not all, of the Python SDK's features. Check the documentation for availability before using a feature, and avoid ones the Node.js SDK does not support.
