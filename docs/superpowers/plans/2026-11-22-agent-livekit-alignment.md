# Agent LiveKit Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `agent/` in line with the structure and guidance of LiveKit's official Node.js starter ([agent-starter-node](https://github.com/livekit-examples/agent-starter-node)) and docs, without changing what the Agent does.

**Architecture:** The Agent's behavior moves into a `ConversationAgent` class in `src/agent.ts` (the starter's `agent.ts`). `conversation-agent.ts` stays the job module that `main.ts` hands to the `@livekit/agents` CLI. LiveKit's tooling guidance (docs MCP, `lk docs`, simulations, testing) is written down in `agent/AGENTS.md`, and a `scenarios.yaml` is added for `lk agent simulate`.

**Tech Stack:** TypeScript, `@livekit/agents` 1.10, Vitest, pnpm workspaces.

**Spec:** none. The human opted out of brainstorming ("theo docs của livekit mà làm"). The scope below is the design.

## Scope and decisions

Where the repo already matches LiveKit's docs, nothing changes. Where it deliberately differs, the repo's decision wins. Each line below is a call made without the human, open to correction when they review this plan.

- **Kept as is:** `main.ts` (CLI entrypoint) separate from `conversation-agent.ts` (job module). The docs allow `ServerOptions.agent` to point at any module. Tests stay in `agent/test/`, not next to the source: the monorepo's Vitest and Sonar config expect it.
- **Kept as is:** no LiveKit Inference anywhere (the starter and docs examples use `inference.STT/TTS/LLM`; `test/no-livekit-inference.spec.ts` forbids it).
- **Kept as is:** the greeting stays in `startConversation`, not in the Agent's `onEnter`: it must wait until the room is connected.
- **Changed:** Task 1 extracts the Agent class. Task 2 adds `agent/AGENTS.md` and commits the `livekit-docs` MCP entry already added to `.mcp.json`. Task 3 adds `agent/scenarios.yaml`.
- **Not done:** `Dockerfile`, `taskfile.yaml`, `.github/` CI for simulations (needs LiveKit Cloud secrets), noise cancellation, handoffs (one Agent, no workflow to split).

## Global Constraints

- The Agent's instructions stay exactly: `You are a helpful general-purpose voice assistant. Always answer in English, briefly and clearly, because your answers are spoken aloud.`
- The Agent has no tools.
- No LiveKit Inference: no `inference.STT`, `inference.TTS`, `inference.LLM` in `agent/src`.
- No `NOSONAR`, `@ts-ignore`, ESLint or Sonar exclusions (CLAUDE.md).
- No secret in any committed file.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Test Strategy

| Scenario                                                                                       | Unit                                         | Integration                                   | E2E                                                                          |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| The Agent still greets the User first with "Hello, how can I help?", in English, with no tools | `agent.spec.ts › ConversationAgent` (Task 1) | `greeting.spec.ts` (unchanged, run in Task 1) | `conversation.spec.ts › a person registers, starts a Conversation…` (Task 4) |

**Unit run:** `pnpm test`
**Integration run:** `pnpm test`
**E2E run:** `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-22-agent-livekit-alignment pnpm test:e2e`
**E2E evidence:** `docs/superpowers/evidence/2026-11-22-agent-livekit-alignment/` — video, screenshots and traces written by Playwright through `E2E_EVIDENCE_DIR`.

Integration and Unit share one command: the repo's Vitest run holds both (`greeting.spec.ts` runs the Agent through `voice.testing`). Tasks 2 and 3 change no behavior; Prettier covers their files.

## Quality Gates

All green at base commit `ebe9973` (format, lint, typecheck; 40 test files, 463 tests, 95% line coverage), so every gate is whole-project.

**Format run:** `pnpm format:check`
**Lint run:** `pnpm lint`
**Typecheck run:** `pnpm typecheck`
**Build run:** none — no build step: the agent runs TypeScript directly with Node (`agent/package.json` has no `build` script).
**Sonar run:** `pnpm sonar`

## Review Focus

1. The Agent gains a tool or changes its instructions during the extraction. Task 1's unit test pins both.
2. `main.ts` stops finding the job module. `conversation-agent.spec.ts` dispatches through the default export and must keep passing; Task 4's e2e starts the real Agent through `main.ts`.
3. `agent/AGENTS.md` copies the docs' `inference.*` examples and tells a future agent to use LiveKit Inference. Task 2 states the prohibition and checks it is there.
4. A key or token pasted into `AGENTS.md` or `scenarios.yaml`. Tasks 2 and 3 grep for key shapes.
5. `scenarios.yaml` without the IDs the CLI requires is read as broken. Task 3 says the CLI adds them, and stops for the human.

---

### Task 1: Extract `ConversationAgent` into `src/agent.ts`

**Files:**

- Create: `agent/src/agent.ts`
- Modify: `agent/src/conversation-agent.ts:1-30` (remove `INSTRUCTIONS`, use the class in `startConversation`)
- Test: `agent/test/agent.spec.ts`

**Interfaces:**

- Consumes: `voice.Agent` from `@livekit/agents`.
- Produces: `export class ConversationAgent extends voice.Agent` with a no-argument constructor. Task 4 relies on the Agent still joining rooms through `startConversation(session: voice.AgentSession, room?: Room): Promise<void>`, whose signature does not change.

- [ ] **Step 1: Write the failing test** in `agent/test/agent.spec.ts`, importing `ConversationAgent` from `../src/agent.ts`. One `describe('ConversationAgent')` with:
  - `it('is a voice.Agent')`: `expect(new ConversationAgent()).toBeInstanceOf(voice.Agent)`.
  - `it('answers in English, briefly, because its answers are spoken')`: `expect(agent.instructions).toBe('You are a helpful general-purpose voice assistant. Always answer in English, briefly and clearly, because your answers are spoken aloud.')`.
  - `it('has no tools')`: `expect(Object.keys(agent.toolCtx)).toEqual([])` (a `ToolContext` is keyed by tool id).

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run agent/test/agent.spec.ts`
Expected: FAIL, cannot resolve `../src/agent.ts`.

- [ ] **Step 3: Create `agent/src/agent.ts`** exporting `class ConversationAgent extends voice.Agent` whose constructor calls `super({ instructions })` with the instructions from Global Constraints. Move the doc comment on `INSTRUCTIONS` with it. In `conversation-agent.ts`, delete `INSTRUCTIONS` and pass `new ConversationAgent()` to `session.start`.

- [ ] **Step 4: Run the Agent's tests**

Run: `pnpm vitest run --project agent`
Expected: PASS, including `greeting.spec.ts` and `conversation-agent.spec.ts` unchanged.

- [ ] **Step 5: Run the gates the pre-commit hook runs, then commit**

Run: `pnpm format:check && pnpm lint && pnpm typecheck`
Expected: no errors.

```bash
git add agent/src/agent.ts agent/src/conversation-agent.ts agent/test/agent.spec.ts
git commit -m "refactor(agent): move the Agent's instructions into a ConversationAgent class"
```

### Task 2: `agent/AGENTS.md` and the docs MCP entry

**Files:**

- Create: `agent/AGENTS.md`, `agent/CLAUDE.md` (symlink to `AGENTS.md`, as at the repo root)
- Modify: `CLAUDE.md` (the "MCP servers" section: list `livekit-docs`), `.mcp.json` (already holds the `livekit-docs` entry, uncommitted)

**Interfaces:**

- Consumes: nothing. Produces: nothing code-wise.

- [ ] **Step 1: Write `agent/AGENTS.md`**, in English, short, adapting the starter's [AGENTS.md](https://github.com/livekit-examples/agent-starter-node/blob/main/AGENTS.md) to this repo. Sections: tooling (pnpm, `pnpm check`); LiveKit documentation (the `livekit-docs` MCP server in `.mcp.json`, `lk docs`, and Context7 `/websites/livekit_io_agents`); file layout (`main.ts` CLI entrypoint, `conversation-agent.ts` job module, `agent.ts` the Agent class, `config/` environment and models); testing (`voice.testing` with `session.run` in `agent/test/`, the live tier `pnpm test:live`, and simulations through `scenarios.yaml`); a **LiveKit Inference** paragraph saying this repo never uses it, so docs examples with `inference.STT/TTS/LLM` must be replaced by the provider plugins in `config/session-options.ts`; handoffs for workflows instead of long instructions; Node.js SDK parity with Python (check the docs before using a feature). No keys.

- [ ] **Step 2: Create the symlink and update the root file**

Run: `ln -s AGENTS.md agent/CLAUDE.md`
Then in `CLAUDE.md`, change the MCP list to include `livekit-docs` (LiveKit docs, code search and changelog) next to context7.

- [ ] **Step 3: Verify**

Run: `pnpm format:check && grep -c "LiveKit Inference" agent/AGENTS.md && ! grep -nE "sk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{10}" agent/AGENTS.md`
Expected: format passes, the grep count is at least 1 (the prohibition is written down), and no key shape is found.

- [ ] **Step 4: Commit**

```bash
git add agent/AGENTS.md agent/CLAUDE.md CLAUDE.md .mcp.json
git commit -m "docs(agent): add AGENTS.md from LiveKit's starter and register the LiveKit docs MCP"
```

### Task 3: `agent/scenarios.yaml` for `lk agent simulate` (needs the human)

**Files:**

- Create: `agent/scenarios.yaml`

**Interfaces:** none.

The simulation runs on LiveKit Cloud, needs `lk` 2.19.0 or later (not installed on this machine) and a real provider key, because the fake Provider answers nothing. Write the file, then stop and report; do not install `lk` or put keys anywhere.

- [ ] **Step 1: Write three scenarios**, following [Write a scenario](https://docs.livekit.io/testing/simulations/write-a-scenario/) (`label`, `instructions`, `agent_expectations`, `tags`; no `id`s, since the CLI generates them):
  - Greeting: the caller says nothing first; the Agent says "Hello, how can I help?".
  - Question: the caller asks a general question; the Agent answers in English in a few sentences.
  - Language: the caller speaks Vietnamese; the Agent still answers in English.

- [ ] **Step 2: Verify the file**

Run: `pnpm format:check && ! grep -nE "sk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{10}" agent/scenarios.yaml`
Expected: both pass.

- [ ] **Step 3: Commit, then report to the human**

```bash
git add agent/scenarios.yaml
git commit -m "test(agent): add scenarios for LiveKit simulations"
```

Report: the human runs `lk agent simulate text --scenarios agent/scenarios.yaml` once `lk` is installed and the provider keys are set; the CLI offers to add the missing IDs, and the file should be committed again after that.

### Task 4: End-to-end scenarios

**Files:** no production code.

**Interfaces:** consumes `startConversation` from Task 1, unchanged.

The scenario "a person starts a Conversation and the Agent joins its room" is already `e2e/tests/conversation.spec.ts`, written from the product's behavior, not from the code. No new test is needed.

- [ ] **Step 1: Run it with evidence**

Run: `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-22-agent-livekit-alignment pnpm test:e2e`
Expected: PASS, and the evidence directory holds videos, screenshots and traces.

- [ ] **Step 2: Prove it can fail.** In `agent/src/conversation-agent.ts`, temporarily remove the `await session.start(...)` call in `startConversation`, rerun the command in Step 1.
      Expected: FAIL (the Agent never shows its state). Restore the call with `git checkout agent/src/conversation-agent.ts` only if Task 1 is committed, which it is.

- [ ] **Step 3: Rerun Step 1** to leave passing evidence in the directory. No commit: the evidence directory is untracked work for `verification-before-completion`.
