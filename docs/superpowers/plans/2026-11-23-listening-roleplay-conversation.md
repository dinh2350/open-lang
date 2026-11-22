# Listening Role-play Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the general-purpose voice Agent into an office-English role-play partner with listening support: the User picks a Scenario and a speaking speed, presses "Chưa nghe kịp" when lost, and gets a Vietnamese Report after the Conversation.

**Architecture:** The backend creates a Conversation record when it issues a Room Token and passes the User's validated choice to the Agent as dispatch metadata. The Agent (Realtime mode) plays the persona, streams every turn and every button press to the backend as it happens, and the backend stores them in Postgres. The Report is built by the backend after the Conversation, from the stored turns: pure code computes misses and fluency, a language model drafts explanations and grammar fixes, and a React Report page renders it.

**Tech Stack:** TypeScript, pnpm workspaces, NestJS 12 + Prisma 7 + Postgres, LiveKit Agents for Node 1.10 (OpenAI/Google Realtime), React 19 + Astryx 0.7.17 + react-router 8 + TanStack Query, Vitest 5 (+ Testcontainers), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-listening-roleplay-conversation-design.html` (read it with this plan; it holds the evidence and the approved UI descriptions).

## Global Constraints

- `pnpm check` and `pnpm sonar` must both pass before the work is done; run `pnpm test:e2e` too because the Conversation flow and the Agent change.
- Fix the code, never the scanner: no `NOSONAR`, `@ts-ignore`, ESLint or Sonar exclusions, or lowered thresholds. Report any new Security Hotspot to the human and stop.
- Write the test first (`test-driven-development`); do not claim "done" before `verification-before-completion`.
- Agent Mode stays Realtime; the `speed` option is confirmed only for OpenAI Realtime (0.25–1.5, applied between model turns). For Google Gemini Live the pace goes through the prompt.
- The `fake` Provider must keep working with no API key, so end-to-end tests make no AI calls. The Agent never uses LiveKit Inference (`apps/agent/test/no-livekit-inference.spec.ts` enforces it).
- Secrets and API keys live in environment variables and `.env` files that are not committed; `.env.example` files hold names and safe dev values only.
- The frontend UI is Astryx only (`@astryxdesign/core` and `@astryxdesign/theme-stone`, pinned at 0.7.17): no new UI library, no Tailwind, plain CSS only for the voice bars as today. Every new screen must work in light and dark mode, and colors and type come from Astryx, not from the mockups.
- Scenarios are exactly `daily-standup`, `one-on-one` and `client-delay-call`. Speeds are exactly 0.7, 0.85 (default, labelled "Vừa") and 1 (labelled "Bình thường"; 0.7 is "Chậm").
- The in-session screen shows only the Scenario badge, a status line, the voice bars and two buttons, "Chưa nghe kịp" and "Kết thúc". No conversation text appears until the Report.
- The Report page is one scrolling page: a title (Scenario, duration, date, speed), three number cards (missed sentences, grammar issues, words per minute), then "1. Câu bạn nghe sót", "2. Lỗi ngữ pháp", "3. Trôi chảy". At most 5 grammar issues. Explanations are in Vietnamese; examples and corrections are in English. The filler-word count is labelled an estimate.
- "Nghe sót" is only the presses of "Chưa nghe kịp". Nothing detects misses automatically.
- Every Conversation record is keyed by `userId`; one User must never read another User's Conversations or Reports.
- Store text only, never audio. No UI to delete a Conversation.
- Backend: the API prefix is spelled only in `apps/backend/src/routes.ts` (`apps/backend/test/structure.spec.ts` enforces it); guards, decorators and exceptions live in their `auth/` folders.
- All UI copy added by this plan is Vietnamese; the sign-in, register and Admin pages keep their English copy.

## Test Strategy

| Scenario                                                                                                  | Unit                                                                                            | Integration                                                                           | E2E                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Pick "họp standup", speed 0.85, Bắt đầu: the Agent greets in role and asks what you did yesterday         | `opens the daily standup in role with its opening line` (Task 7)                                | `a job dispatched with Scenario metadata starts that Scenario at that speed` (Task 7) | `a person picks a Scenario and speed and the session shows that Scenario` (Task 12) |
| Press "Chưa nghe kịp" mid-session: the Agent stops, rephrases slower and simpler, and the session goes on | `on the listening help message it interrupts, records the press and rephrases` (Task 9)         | `a press reaches the backend as a Miss` (Task 9)                                      | `pressing Chưa nghe kịp lists the sentence being said, in the Report` (Task 12)     |
| End the session: within about a minute the Report lists the missed sentence with a Vietnamese explanation | `resolveMisses picks the Agent turn playing when the button was pressed` (Task 4)               | `a Report lists each missed Agent sentence with its explanation` (Task 5)             | `pressing Chưa nghe kịp lists the sentence being said, in the Report` (Task 12)     |
| Say a wrong sentence on purpose: the Report shows the error, the correct sentence and why                 | `composeReport keeps at most five grammar issues` (Task 4)                                      | `a Report lists grammar issues from the User's turns` (Task 5)                        | `a wrong sentence appears in the Report with its correction` (Task 12)              |
| Close the tab mid-session: the history still lists the Conversation and its Report can be made            | `the history page lists past Conversations, newest first` (Task 11)                             | `a Conversation never ended still produces a Report from its stored turns` (Task 5)   | `an abandoned Conversation still has a Report from the history` (Task 12)           |
| Another User signs in and sees none of your Conversations                                                 | `the Report page says the Conversation was not found when the backend answers 404` (Task 11)    | `another User's Conversation answers 404` (Task 5)                                    | `a second User cannot open the first User's Report` (Task 12)                       |
| While the Agent talks, the screen has only the voice bars and two buttons, no conversation text           | `the in-session screen shows the voice bars and two buttons and no conversation text` (Task 10) | `the Agent session publishes no transcription to the room` (Task 7)                   | `during a session no conversation text appears` (Task 12)                           |

**Unit run:** `pnpm test`
**Integration run:** `pnpm exec vitest run --project backend`
**E2E run:** `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-23-listening-roleplay pnpm test:e2e`
**E2E evidence:** `docs/superpowers/evidence/2026-11-23-listening-roleplay/` — Playwright writes a video, screenshots and a trace of every test there.

`pnpm test` runs every Vitest project with coverage (including the backend's Postgres-backed specs, which need Docker) and writes the lcov reports Sonar reads; the Integration run repeats the backend project alone.

## Quality Gates

**Format run:** `pnpm format:check`
**Lint run:** `pnpm lint`
**Typecheck run:** `pnpm typecheck`
**Build run:** `pnpm --filter @open-lang/frontend build && pnpm --filter @open-lang/backend exec nest build`
**Sonar run:** `pnpm sonar`

At the base commit `4126cc86046f2e230075a2ef5896b0119866607e` format, lint, typecheck and `pnpm test` were all green, so every gate is whole-project. The repo has its own SonarQube setup (`pnpm sonar:up`, `pnpm sonar:setup`, `sonar-project.properties`) and no CI config; `pnpm sonar` reads `SONAR_TOKEN` from the environment.

## Review Focus

1. Realtime transcripts arrive late and out of order: turns must be ordered by `startedAt`, never by arrival, and the Agent pairs speaking intervals with messages first in, first out (tests in Tasks 5 and 8).
2. The Agent retries a request the backend already stored: one turn per `itemId`, never two (Task 3).
3. A Conversation with no turns, or a press with no earlier Agent turn: an empty Report, no model call, no crash (Tasks 4 and 5).
4. The report model fails or returns bad JSON: the Report is marked failed, the transcript stays intact, and asking again retries (Tasks 5 and 6).
5. A client sends an unknown Scenario, a speed outside the three, another User's room, or the ingest API gets a wrong key: 400, 404 and 401, with nothing stored (Tasks 2, 3 and 5).

---

### Task 1: Shared contracts and the shared package's test setup

**Files:**

- Create: `packages/shared/src/scenario.ts`, `packages/shared/src/conversation-report.ts`
- Create: `packages/shared/vitest.config.ts`, `packages/shared/test/scenario.spec.ts`, `packages/shared/test/conversation-report.spec.ts`
- Modify: `packages/shared/src/index.ts` (export everything below), `packages/shared/package.json` (devDependency `vitest: catalog:`), `packages/shared/tsconfig.json` (`include` adds `test` and `vitest.config.ts`), `sonar-project.properties` (`sonar.tests` adds `packages/shared/test`)

**Interfaces:**

- Produces from `scenario.ts`:
  - `SCENARIO_IDS = ['daily-standup', 'one-on-one', 'client-delay-call'] as const`; `scenarioIdSchema`; `type ScenarioId`.
  - `interface ScenarioInfo { id: ScenarioId; title: string; description: string; personaName: string }` and `SCENARIOS: readonly ScenarioInfo[]` in that order. Vietnamese titles: "Họp standup", "Họp 1:1 với quản lý", "Gọi khách trễ hạn". Descriptions: "Báo cáo việc hôm qua, hôm nay và vướng mắc.", "Nhận phản hồi, nói về mục tiêu.", "Giải thích và xin thêm thời gian.". Persona names: Sam, Alex, Jordan.
  - `SPEEDS = [0.7, 0.85, 1] as const`; `speedSchema` (accepts exactly those); `type Speed`; `SPEED_LABELS: Record<Speed, string>` (`0.7: 'Chậm'`, `0.85: 'Vừa'`, `1: 'Bình thường'`); `DEFAULT_SPEED: Speed = 0.85`.
  - `conversationChoiceSchema = z.object({ scenarioId, speed })`; `type ConversationChoice`.
  - `LISTENING_HELP_MESSAGE = 'listening-help'` (the text the button sends on LiveKit's `lk.chat` topic).
- Produces from `conversation-report.ts` (all zod schemas with inferred types):
  - `reportStatusSchema = z.enum(['generating', 'ready', 'failed'])`.
  - `listeningMissSchema { agentText: string; keyPhrases: string[]; explanation: string }`, `grammarIssueSchema { said: string; corrected: string; reason: string }`, `fluencySchema { wordsPerMinute: number | null; talkRatio: number | null (0..1); fillerWordsEstimate: int >= 0; longestTurnSeconds: number | null }`.
  - `conversationReportSchema { listeningMisses: listeningMiss[]; grammarIssues: grammarIssue[] (max 5); fluency }`.
  - `conversationSummarySchema { roomName; scenarioId; speed; createdAt: iso datetime string; durationSeconds: number | null; reportStatus: reportStatus | null }`, `conversationListSchema { conversations: summary[] }`, `conversationDetailSchema = summary.extend({ report: conversationReport | null })`.
  - Agent-to-backend bodies: `turnIngestSchema { itemId: string (min 1); role: 'agent' | 'user'; text: string (min 1); startedAt: iso datetime; endedAt?: iso datetime }`, `missIngestSchema { pressedAt: iso datetime }`.
  - Inferred types, exported under these names: `ReportStatus`, `ListeningMiss`, `GrammarIssue`, `Fluency`, `ConversationReport`, `ConversationSummary`, `ConversationList`, `ConversationDetail`, `TurnIngest`, `MissIngest`.

- [ ] **Step 1: Write the failing tests**

`scenario.spec.ts`: `lists the three Scenarios in order with Vietnamese title and description and a persona name` (ids equal `['daily-standup','one-on-one','client-delay-call']`; persona names Sam, Alex, Jordan); `accepts a choice only with one of the three speeds` (`{scenarioId:'daily-standup',speed:0.85}` parses; `speed: 0.9` and `speed: 2` fail); `rejects an unknown Scenario`; `defaults to a speed that is one of SPEEDS` (`DEFAULT_SPEED` is 0.85 and in `SPEEDS`).
`conversation-report.spec.ts`: `caps grammar issues at five` (6 issues fail, 5 pass); `allows null fluency numbers but requires every field` (an object missing `fillerWordsEstimate` fails; nulls for the other three pass); `turn ingest needs a non-empty text and an ISO startedAt` (`text: ''` fails, `startedAt: 'yesterday'` fails, omitted `endedAt` passes); `rejects a talkRatio above 1`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `pnpm exec vitest run --project shared`
Expected: FAIL (project `shared` or the modules do not exist yet).

- [ ] **Step 3: Implement the two modules, the Vitest config (`defineProject`, name `shared`, `include: ['test/**/*.spec.ts']`), the index exports and the config edits listed under Files**

Follow the style of `packages/shared/src/auth.ts` (zod 4, `z.infer` types, a doc comment per export).

- [ ] **Step 4: Run the tests and see them pass**

Run: `pnpm exec vitest run --project shared && pnpm typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared sonar-project.properties pnpm-lock.yaml
git commit -m "feat(shared): Scenario, speed and Report contracts"
```

### Task 2: Data model, and a Conversation created with every Room Token

**Files:**

- Modify: `apps/backend/prisma/schema.prisma`; create the migration with `pnpm db:migrate --name add_conversations` (needs `docker compose up --detach --wait postgres`)
- Create: `apps/backend/src/conversations/conversations.module.ts`, `apps/backend/src/conversations/conversations.service.ts`
- Modify: `apps/backend/src/livekit/room-token.service.ts`, `apps/backend/src/livekit/room-token.controller.ts`, `apps/backend/src/livekit/livekit.module.ts`, `apps/backend/src/app.module.ts`
- Test: `apps/backend/test/room-token.spec.ts` (modify), `apps/backend/test/conversations.spec.ts` (create)

**Interfaces:**

- Prisma additions (the `User` model gains `conversations Conversation[]`):

```prisma
enum TurnRole {
  agent
  user
}

enum ReportStatus {
  generating
  ready
  failed
}

model Conversation {
  id         String   @id @default(uuid(7)) @db.Uuid
  userId     String   @db.Uuid
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  roomName   String   @unique
  scenarioId String
  speed      Float
  createdAt  DateTime @default(now())
  turns      Turn[]
  misses     Miss[]
  report     Report?
  @@index([userId, createdAt])
}
model Turn {
  id             String       @id @default(uuid(7)) @db.Uuid
  conversationId String       @db.Uuid
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  itemId         String
  role           TurnRole
  text           String
  startedAt      DateTime
  endedAt        DateTime?
  @@unique([conversationId, itemId])
}
model Miss {
  id             String       @id @default(uuid(7)) @db.Uuid
  conversationId String       @db.Uuid
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  pressedAt      DateTime
}
model Report {
  conversationId String       @id @db.Uuid
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  status         ReportStatus
  content        Json?
  startedAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}
```

- Produces: `ConversationsService.create(user: User, roomName: string, choice: ConversationChoice): Promise<void>`; `RoomTokenService.issueRoomToken(user: User, request: RoomTokenRequest): Promise<RoomTokenResponse>`. The choice travels in the standard request field `participant_metadata` as a JSON string matching `conversationChoiceSchema`; anything missing or invalid answers `400`. Every other request field stays ignored. The dispatch carries `new RoomAgentDispatch({ agentName, metadata: JSON.stringify(choice) })`.

- [ ] **Step 1: Write the failing tests**

In `room-token.spec.ts`, add a helper `choiceRequest(overrides?)` returning `{ participant_metadata: JSON.stringify({ scenarioId: 'daily-standup', speed: 0.85, ...overrides }) }` and make every existing request that expects `201` send it. Add: `returns 400 without participant_metadata`; `returns 400 for an unknown Scenario`; `returns 400 for a speed that is not 0.7, 0.85 or 1` (send `2`); `dispatches the Agent with the choice as its metadata` (`JSON.parse(agents[0].metadata)` equals `{ scenarioId: 'client-delay-call', speed: 0.7 }`). Change `ignores every client-supplied field` to send the valid `participant_metadata` plus extra keys (`role: 'admin'`) and still expect `claims.metadata` falsy and the other fields ignored.
`conversations.spec.ts`: `creates a Conversation of the signed-in User, named after the room in the token, with the chosen Scenario and speed` (read it with `app.get(PrismaService)`), and `creates one Conversation per token request`.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project backend apps/backend/test/room-token.spec.ts apps/backend/test/conversations.spec.ts`
Expected: FAIL (400 and Conversation assertions).

- [ ] **Step 3: Implement**

Edit the schema, run the migration, add `ConversationsModule` (imports `PrismaModule`, exports the service), have `LiveKitModule` import it, pass `request` from the controller to the service, parse the choice with `conversationChoiceSchema` (a `BadRequestException` on failure), call `conversations.create` before returning the token, and set the dispatch metadata. Keep the room name `conversation-<uuid>`.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project backend`
Expected: PASS (the whole backend project, so no other spec regressed).

- [ ] **Step 5: Commit**

```bash
git add apps/backend packages/shared
git commit -m "feat(backend): create a Conversation with each Room Token"
```

### Task 3: Agent ingest API

**Files:**

- Create: `apps/backend/src/auth/guards/agent-key.guard.ts`, `apps/backend/src/auth/decorators/agent-only.decorator.ts`, `apps/backend/src/conversations/agent-ingest.controller.ts`
- Modify: `apps/backend/src/config/env.schema.ts` (`AGENT_API_KEY: z.string().min(32)`), `apps/backend/src/conversations/conversations.service.ts`, `apps/backend/src/conversations/conversations.module.ts`, `apps/backend/.env.example`, `apps/backend/test/support/test-app.ts` (`testEnv.AGENT_API_KEY`), `apps/backend/test/env-schema.spec.ts`, `apps/backend/test/startup.spec.ts` (whatever lists required variables)
- Test: `apps/backend/test/agent-ingest.spec.ts` (create)

**Interfaces:**

- Routes (controller path `agent/conversations`): `POST :roomName/turns` with a `turnIngestSchema` body and `POST :roomName/misses` with a `missIngestSchema` body, both `204`. They are `@Public()` for the User-token guard and instead require `Authorization: Bearer <AGENT_API_KEY>` (`@AgentOnly()` applies both; compare with `timingSafeEqual`); anything else `401`. An unknown `roomName` is `404`.
- Produces: `ConversationsService.recordTurn(roomName: string, turn: TurnIngest): Promise<void>` (upsert on `[conversationId, itemId]`: a repeat updates `text`, `startedAt`, `endedAt`); `recordMiss(roomName: string, miss: MissIngest): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`agent-ingest.spec.ts`: `returns 401 without a key and with a wrong key`; `a User's own Auth Token is not an Agent key` (401); `returns 404 for a room that has no Conversation`; `stores a turn` (204, one row with role, text and times); `stores a retried turn once, with its latest values` (same `itemId` twice, second with an `endedAt` → one row carrying it); `rejects a turn with empty text` (400, nothing stored); `stores a Miss`. `env-schema.spec.ts`: `requires AGENT_API_KEY of at least 32 characters`.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project backend apps/backend/test/agent-ingest.spec.ts apps/backend/test/env-schema.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the guard, decorator, controller and service methods; add the env variable everywhere the tests and `.env.example` need it.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project backend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): let the Agent post turns and Misses with a shared key"
```

### Task 4: Report logic: misses, fluency, draft contract, composition

**Files:**

- Create: `apps/backend/src/reports/resolve-misses.ts`, `fluency.ts`, `report-model.ts`, `fake-report-model.ts`, `compose-report.ts`
- Test: `apps/backend/test/resolve-misses.spec.ts`, `fluency.spec.ts`, `compose-report.spec.ts`, `fake-report-model.spec.ts` (all create)

**Interfaces:**

- Produces, with `type Role = 'agent' | 'user'`:

```ts
export interface TurnTimes {
  readonly role: Role;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}
export interface TimedTurn extends TurnTimes {
  readonly text: string;
}
/** Turns must be sorted by startedAt. Returns distinct indexes into `turns`, ascending. */
export function resolveMisses(
  turns: readonly TurnTimes[],
  pressedAt: readonly Date[],
): number[];
export function computeFluency(turns: readonly TimedTurn[]): Fluency; // Fluency from @open-lang/shared
export function conversationDurationSeconds(
  turns: readonly TurnTimes[],
): number | null;

export interface ReportInput {
  readonly scenarioId: ScenarioId;
  readonly transcript: readonly { role: Role; text: string }[];
  readonly missedTurnIndexes: readonly number[];
}
export interface ReportDraft {
  readonly listeningMisses: readonly {
    turnIndex: number;
    keyPhrases: string[];
    explanation: string;
  }[];
  readonly grammarIssues: readonly GrammarIssue[];
}
export interface ReportModel {
  draft(input: ReportInput): Promise<ReportDraft>;
}
export class ReportModelError extends Error {}
export function parseReportDraft(text: string): ReportDraft; // throws ReportModelError
export function composeReport(
  turns: readonly TimedTurn[],
  missedTurnIndexes: readonly number[],
  draft: ReportDraft,
): ConversationReport;
export class FakeReportModel implements ReportModel {}
```

- Rules: `resolveMisses` picks, per press, the Agent turn whose `[startedAt, endedAt]` contains the press, otherwise the latest Agent turn that started before it, otherwise nothing; a turn without `endedAt` counts only as "started before". `computeFluency`: `wordsPerMinute` = User words ÷ minutes of timed User turns (null with none); `talkRatio` = timed User seconds ÷ seconds from the first start to the last end (null with no timed turns); `fillerWordsEstimate` counts the whole words `um`, `uh`, `er`, `erm` (case-insensitive) in User turns; `longestTurnSeconds` is the longest timed User turn (null with none). `composeReport` keeps at most 5 grammar issues, takes `agentText` from the transcript turn named by `turnIndex`, and drops draft misses whose `turnIndex` is not in `missedTurnIndexes`. `FakeReportModel` explains every missed turn with the explanation `Giải thích thử nghiệm.` and no key phrases, and turns every User turn into a grammar issue whose `said` is the turn's text, whose `corrected` is that text followed by " (đã sửa)", and whose `reason` is `Lý do thử nghiệm.`.

- [ ] **Step 1: Write the failing tests**

`resolve-misses.spec.ts`: `picks the Agent turn playing when the button was pressed`; `falls back to the latest Agent turn that started before the press`; `ignores a press before any Agent turn`; `counts a turn once however often it was pressed`; `never picks a User turn`; `treats a turn without an end as started before the press only`.
`fluency.spec.ts`: `wordsPerMinute is the User's words over the User's timed speaking time` (three User turns totalling 20 words in 12 s → 100); `is null when no User turn is timed`; `talkRatio is timed User seconds over the whole span`; `counts um, uh, er and erm as whole words only` ("umbrella" and "her" do not count); `longestTurnSeconds is the longest timed User turn`; and `conversationDurationSeconds` is the span from the first start to the last end, null without turns.
`compose-report.spec.ts`: `keeps at most five grammar issues`; `takes the Agent's own words from the transcript`; `drops a listening miss that names a turn that was not missed`; `returns empty lists for an empty draft`. Also `parseReportDraft`: `accepts the draft JSON, also inside a json code fence`; `throws ReportModelError on text that is not JSON`; `throws ReportModelError when an issue has no corrected sentence`. `fake-report-model.spec.ts`: `explains every missed turn and turns every User turn into a grammar issue`.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project backend apps/backend/test/resolve-misses.spec.ts apps/backend/test/fluency.spec.ts apps/backend/test/compose-report.spec.ts apps/backend/test/fake-report-model.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the five modules as pure code (no Nest, no Prisma). Validate drafts with zod.

- [ ] **Step 4: Run and see them pass**

Run: the Step 2 command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/reports apps/backend/test
git commit -m "feat(backend): report logic for misses, fluency and drafts"
```

### Task 5: Report service and the User's Conversation API

**Files:**

- Create: `apps/backend/src/reports/report.service.ts`, `apps/backend/src/reports/reports.module.ts`, `apps/backend/src/conversations/conversations.controller.ts`
- Modify: `apps/backend/src/conversations/conversations.service.ts` (list, get), `apps/backend/src/conversations/conversations.module.ts`, `apps/backend/src/app.module.ts`, `apps/backend/src/config/env.schema.ts` (`REPORT_PROVIDER: z.enum(['fake']).default('fake')`, widened in Task 6), `apps/backend/test/support/test-app.ts`
- Test: `apps/backend/test/conversations-api.spec.ts`, `apps/backend/test/reports.spec.ts` (create)

**Interfaces:**

- `export const REPORT_MODEL = Symbol('REPORT_MODEL')`, added to `apps/backend/src/reports/report-model.ts`, is the injection token; `ReportsModule` provides it from `REPORT_PROVIDER` (`fake` → `FakeReportModel`).
- `startTestApp(envOverrides?, configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder)`: the new optional second argument lets a spec call `.overrideProvider(REPORT_MODEL).useValue(...)`.
- Routes under `conversations` (signed-in User, no Admin needed): `GET /` → `conversationListSchema`, newest first, only the User's own; `GET /:roomName` → `conversationDetailSchema` (`404` when it is not the User's); `POST /:roomName/report` → `202 { status }`.
- `ReportService.start(user: User, roomName: string): Promise<ReportStatus>`: ready → return ready; generating and younger than 120 000 ms → return generating without a second model call; otherwise set `generating` and run in the background: load the turns ordered by `startedAt` and the Misses, `resolveMisses`, `computeFluency`, and call the model; no turns → a ready empty Report and no model call; success → store `composeReport(...)` as ready; any error (including `ReportModelError`) → `failed`, turns untouched. `durationSeconds` in the summaries comes from `conversationDurationSeconds`; `reportStatus` is `null` when there is no Report row.

- [ ] **Step 1: Write the failing tests**

`conversations-api.spec.ts`: `lists only the signed-in User's Conversations, newest first, with Scenario, speed, duration and report status`; `another User's Conversation answers 404`; `an unknown room answers 404`; `requires an Auth Token` (401).
`reports.spec.ts` (use `vi.waitFor` to poll `GET /:roomName` until the status settles): `a Report lists each missed Agent sentence with its explanation` (one Agent turn, one Miss pressed during it; `agentText` equals the turn text, `explanation` is `Giải thích thử nghiệm.`); `a Report lists grammar issues from the User's turns`; `orders turns by start time even when they arrived late` (post the second turn first; the Miss still resolves to the right Agent sentence); `a Conversation never ended still produces a Report from its stored turns`; `an empty Conversation gets an empty ready Report and the model is never called` (override `REPORT_MODEL` with a counting spy); `a press with no earlier Agent turn is left out`; `a model error marks the Report failed, keeps the turns, and asking again makes it ready` (override with a model that fails once); `invalid model output marks the Report failed` (model throws `ReportModelError`); `a Report that is generating and younger than two minutes is not started again` (spy called once after two POSTs); `POST report for another User's room answers 404`.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project backend apps/backend/test/conversations-api.spec.ts apps/backend/test/reports.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the controller, the service logic, the module wiring and the test-app override.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project backend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): Conversation API and Report generation"
```

### Task 6: Real report providers (OpenAI and Google)

**Files:**

- Create: `apps/backend/src/reports/report-prompt.ts`, `openai-report-model.ts`, `google-report-model.ts`, `create-report-model.ts`
- Create: `apps/backend/test/report-prompt.spec.ts`, `report-models.spec.ts`, `apps/backend/test/live/report-model.live.spec.ts`
- Modify: `apps/backend/src/config/env.schema.ts`, `apps/backend/src/reports/reports.module.ts`, `apps/backend/.env.example`, `apps/backend/package.json` (add the Providers' official Node SDKs, `openai` and `@google/genai`, at the versions their docs recommend, and a `test:live` script like the Agent's), `apps/backend/vitest.config.ts` (exclude `test/live/**`), `apps/backend/test/env-schema.spec.ts`

**Interfaces:**

- Env: `REPORT_PROVIDER: 'fake' | 'openai' | 'google'` (default `fake`), `REPORT_MODEL` (optional; defaults equal the Agent's Pipeline LLM defaults in `apps/agent/src/config/models.ts`: `gpt-6-luna`, `gemini-3.8-flash`), `OPENAI_API_KEY` (required when `openai`), `GOOGLE_API_KEY` (required when `google`; Vertex AI is out of scope).
- Produces: `type ReportEnv = Pick<BackendEnv, 'REPORT_PROVIDER' | 'REPORT_MODEL' | 'OPENAI_API_KEY' | 'GOOGLE_API_KEY'>`; `buildReportPrompt(input: ReportInput): { system: string; user: string }`; `class OpenAiReportModel implements ReportModel` and `class GoogleReportModel implements ReportModel`, each taking its SDK client and model name in the constructor, asking for JSON and returning `parseReportDraft(text)`; `createReportModel(env: ReportEnv): ReportModel`.
- The prompt must: tell the model the learner is a Vietnamese office worker practising spoken English; number every transcript turn so `turnIndex` matches `ReportInput.transcript`; list the missed turn indexes and ask for `keyPhrases` and a Vietnamese `explanation` for each (idioms, reduced forms, phrasal verbs, acronyms); ask for at most 5 grammar issues from User turns only, each with `said`, `corrected` (English) and a Vietnamese `reason`; forbid praise, scores and anything outside the JSON shape of `ReportDraft`.

- [ ] **Step 1: Write the failing tests**

`report-prompt.spec.ts`: `numbers every transcript turn and lists the missed indexes`; `asks for Vietnamese explanations and at most five grammar issues from User turns`. `report-models.spec.ts` (stub SDK clients): `OpenAiReportModel returns the draft parsed from the client's JSON`; `GoogleReportModel returns the draft parsed from the client's JSON`; `both throw ReportModelError when the client returns text that is not a draft`; `createReportModel returns the fake model for fake and the matching class otherwise`. `env-schema.spec.ts`: `requires OPENAI_API_KEY when REPORT_PROVIDER is openai`; `requires GOOGLE_API_KEY when REPORT_PROVIDER is google`; `needs no key for fake`. The live spec (`describe.skipIf` without keys) asks each real model to draft a two-turn transcript and checks the draft parses.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project backend apps/backend/test/report-prompt.spec.ts apps/backend/test/report-models.spec.ts apps/backend/test/env-schema.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** Read each SDK's documentation for the version in the lockfile (the `context7` MCP server is configured) before writing the call; keep the adapters thin so the stubbed tests cover everything except the network call.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project backend && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend pnpm-lock.yaml
git commit -m "feat(backend): OpenAI and Google report models"
```

### Task 7: Agent plays the Scenario at the chosen speed

**Files:**

- Create: `apps/agent/src/scenario-instructions.ts`, `apps/agent/src/conversation-choice.ts`
- Modify: `apps/agent/src/agent.ts` (`ConversationAgent` takes the choice), `apps/agent/src/conversation-agent.ts`, `apps/agent/src/config/session-options.ts`, `apps/agent/scenarios.yaml`, `apps/agent/AGENTS.md` (file layout lines), `apps/agent/test/fake-job.ts` (`dispatchToRoom(agent, roomName, metadata?)` sets the job's `metadata`)
- Test: `apps/agent/test/scenario-agent.spec.ts`, `apps/agent/test/conversation-choice.spec.ts` (create); update `greeting.spec.ts`, `conversation-agent.spec.ts`, `agent.spec.ts` and any other spec that calls `startConversation` or `createSessionOptions`

**Interfaces:**

- `readConversationChoice(metadata: string): ConversationChoice` parses the job's metadata JSON with `conversationChoiceSchema` and throws an `Error` naming the problem when it is missing, not JSON, or invalid.
- `scenarioInstructions(choice: ConversationChoice): string` and `openingLine(scenarioId: ScenarioId): string`. Opening lines, exactly: `daily-standup`: "Morning! Let's start the standup. What did you work on yesterday?"; `one-on-one`: "Hi, thanks for making time. How has your week been going?"; `client-delay-call`: "Hello, this is Jordan from the client team. I heard the delivery is delayed. What happened?". The instructions must: put the Agent in the persona named in `SCENARIOS` with the Scenario's objective; make it speak only English, in short turns, using the idioms, phrasal verbs and reduced forms a real colleague would, at normal workplace frequency; set the pace from the speed (0.7 "slowly and clearly", 0.85 "slightly slower than normal", 1 "at a normal pace"); and forbid teaching or correcting the User during the Conversation, because feedback comes in the Report. The greeting instruction keeps the existing form `Open the conversation by saying exactly: "<opening line>"` so `LiteralLLM` can follow it.
- `class ConversationAgent extends voice.Agent { constructor(choice: ConversationChoice) }`; `startConversation(session: voice.AgentSession, choice: ConversationChoice, room?: Room): Promise<void>` starts the session with `outputOptions: { transcriptionEnabled: false }` (nothing is forwarded to the browser as text) and greets as above; the job entry reads `ctx.job.metadata` and logs `Conversation started` with `scenarioId` and `speed` added.
- `createSessionOptions(config: AgentConfig, speed: Speed)`: the OpenAI realtime model gets `speed`; other Providers ignore it (the pace is in the instructions).

- [ ] **Step 1: Write the failing tests**

`conversation-choice.spec.ts`: `parses valid metadata`; `throws on missing metadata`, `on text that is not JSON`, `on an unknown Scenario`, `on a speed of 2`. `scenario-agent.spec.ts`: `opens the daily standup in role with its opening line` (Pipeline with fakes and `LiteralLLM`, like `greeting.spec.ts`; the first Agent message is the standup line); the same for the other two Scenarios (`it.each`); `the instructions name the persona, the pace for each speed, and forbid correcting the User`; `a job dispatched with Scenario metadata starts that Scenario at that speed` (`dispatchToRoom(..., JSON.stringify({scenarioId:'one-on-one',speed:0.7}))`; the `Conversation started` log has both); `a job with invalid metadata fails` (rejects); `the Agent session publishes no transcription to the room` (spy on `session.start` and assert `outputOptions.transcriptionEnabled === false`); `OpenAI realtime options carry the chosen speed` (mock the plugin module, as `apps/agent/test/google-provider.spec.ts` does for Google).

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project agent`
Expected: FAIL.

- [ ] **Step 3: Implement.** Check the LiveKit docs for whether Gemini Live offers a speaking-rate option; if it does, pass the speed to it, and if not, keep the pace in the instructions only. Update `scenarios.yaml` (the LiveKit simulation file; not run by `pnpm check`) with one scenario per Scenario: the Agent opens with its line, stays in role, never corrects the User. Update the older specs to the new signatures.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project agent && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/agent
git commit -m "feat(agent): play the chosen Scenario at the chosen speed"
```

### Task 8: Agent records the transcript

**Files:**

- Create: `apps/agent/src/backend-client.ts`, `apps/agent/src/transcript-recorder.ts`
- Modify: `apps/agent/src/agent-environment.ts` (adds `BACKEND_URL` as a URL and `AGENT_API_KEY` of at least 32 characters), `apps/agent/src/main.ts`, `apps/agent/src/conversation-agent.ts` (wire the recorder after the session starts), `apps/agent/.env.example`, `README.md` (one paragraph: set the same `AGENT_API_KEY` in `apps/backend/.env` and `apps/agent/.env`; `openssl rand -base64 48` makes one)
- Test: `apps/agent/test/backend-client.spec.ts`, `apps/agent/test/transcript-recorder.spec.ts` (create); update `agent-environment.spec.ts`

**Interfaces:**

- Consumes: `TurnIngest`, `MissIngest` (Task 1); the routes of Task 3.
- Produces:

```ts
export interface BackendClient {
  sendTurn(roomName: string, turn: TurnIngest): Promise<void>;
  sendMiss(roomName: string, miss: MissIngest): Promise<void>;
}
/** Never rejects: 3 attempts (retryDelayMs apart, default 300), then logs a warning and resolves. */
export function createBackendClient(options: {
  backendUrl: string;
  agentApiKey: string;
  retryDelayMs?: number;
}): BackendClient;
/** Sends each user and assistant message once, in order. */
export function recordTranscript(
  session: voice.AgentSession,
  backend: BackendClient,
  roomName: string,
): void;
```

- Requests: `POST <backendUrl>/api/agent/conversations/<roomName>/<turns|misses>` with `Authorization: Bearer <agentApiKey>` and a JSON body. `recordTranscript` listens to `ConversationItemAdded`, keeps one send queue so order is kept, and skips items that are not messages or have no text. Timing: it follows `UserStateChanged` and `AgentStateChanged` events to build speaking intervals per role (speaking until it stops) and pairs each message with the oldest unclaimed interval of its role, FIFO; the turn's `startedAt`/`endedAt` come from that interval. With no interval yet, `startedAt` is the item's `createdAt` and `endedAt` is omitted.

- [ ] **Step 1: Write the failing tests**

`backend-client.spec.ts` (a real `node:http` server on a free port): `posts a turn to the room's turns route with the Bearer key and the JSON body`; `posts a Miss to the misses route`; `retries a failing request and succeeds on the next attempt`; `gives up after three failures without throwing`. `transcript-recorder.spec.ts` (an `AgentSession` emitting events; a stub `BackendClient`): `sends each user and assistant message once, in order, with its itemId`; `skips items that are not messages and messages without text`; `takes a User turn's start and end from the matching speaking interval`; `pairs two Agent turns with their intervals first in, first out`; `omits endedAt while no interval has closed`; `keeps sending when one send is slow` (the queue preserves order). `agent-environment.spec.ts`: `requires BACKEND_URL and a 32-character AGENT_API_KEY`.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project agent apps/agent/test/backend-client.spec.ts apps/agent/test/transcript-recorder.spec.ts apps/agent/test/agent-environment.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** Check the event payload shapes (`createdAt`, states) in the LiveKit docs for `@livekit/agents` 1.10 before coding the interval pairing.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project agent && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Live check of the Realtime transcript (needs a real OpenAI key; not part of `pnpm check`)**

Run the stack with `REALTIME_PROVIDER=openai`, hold a one-minute standup Conversation, then read the stored turns (`docker compose exec postgres psql -U open_lang open_lang -c 'select role, text from "Turn" order by "startedAt"'`). Expected: the Agent's rows match what it said and the User's rows match what was said. If the Agent's text is missing or wrong, stop and tell the human: the spec's fallback is to switch Agent Mode to Pipeline, which gives the exact text of each Agent turn.

- [ ] **Step 6: Commit**

```bash
git add apps/agent README.md
git commit -m "feat(agent): stream the transcript to the backend as it happens"
```

### Task 9: Agent handles "Chưa nghe kịp"

**Files:**

- Create: `apps/agent/src/listening-help.ts`
- Modify: `apps/agent/src/conversation-agent.ts` (pass the handler as `inputOptions.textInputCallback`)
- Test: `apps/agent/test/listening-help.spec.ts` (create)

**Interfaces:**

- Consumes: `LISTENING_HELP_MESSAGE` (Task 1), `BackendClient` (Task 8).
- Produces: `createListeningHelpHandler(deps: { backend: BackendClient; roomName: string; now?: () => Date }): (session: voice.AgentSession, event: voice.TextInputEvent) => void`. For `event.text === LISTENING_HELP_MESSAGE`: take `pressedAt = now()` first, then `session.interrupt()`, `void backend.sendMiss(roomName, { pressedAt: pressedAt.toISOString() })`, and `session.generateReply({ instructions })` with the instruction `The User did not catch what you just said. Say it again in simpler words and more slowly, in English, in one or two short sentences, then carry on the conversation in your role.` For any other text: `session.interrupt()` then `session.generateReply({ userInput: event.text })` (the SDK's default behaviour).

- [ ] **Step 1: Write the failing tests**

`on the listening help message it interrupts, records the press and rephrases` (stub session with `vi.fn()` methods and a stub backend; assert the call order, the `pressedAt` from the injected clock, and the instruction text); `any other text is answered as the User's own message`; `a failing sendMiss does not stop the rephrase`; `a press reaches the backend as a Miss` (a real `AgentSession` with fakes and the real `createBackendClient` against a local `node:http` server; the server receives one POST to `/misses` with an ISO `pressedAt`).

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project agent apps/agent/test/listening-help.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the handler and wire it in the job entry.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project agent && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/agent
git commit -m "feat(agent): rephrase slower and record a Miss on Chưa nghe kịp"
```

### Task 10: Frontend: choose a Scenario, the quiet session screen, the help button

**Files:**

- Create: `apps/frontend/src/conversation/scenario-picker.tsx`, `apps/frontend/src/conversation/listening-help-button.tsx`
- Modify: `apps/frontend/src/conversation/conversation-page.tsx`, `room-token-source.ts`, `agent-status.tsx`, `apps/frontend/src/app.tsx` (pass `onEnded`)
- Test: `apps/frontend/test/scenario-picker.spec.tsx`, `listening-help-button.spec.tsx` (create); update `conversation-page.spec.tsx`, `conversation-page-failures.spec.tsx`, `backend.ts` (record the `participant_metadata` of each token request), `unconnected-room.ts` (the Room double needs a `name` and a `localParticipant.sendText` spy)

**Interfaces:**

- Consumes: `SCENARIOS`, `SPEEDS`, `SPEED_LABELS`, `DEFAULT_SPEED`, `LISTENING_HELP_MESSAGE`, `ConversationChoice` (Task 1).
- Produces: `ScenarioPicker({ onStart }: { onStart(choice: ConversationChoice): void })`: heading "Luyện nói hôm nay", the line "Chọn một tình huống công sở.", three `SelectableCard`s (first selected), the label "Tốc độ Agent nói" with a `SegmentedControl` (Vừa selected), and a primary "Bắt đầu" button. `ListeningHelpButton()` sends `LISTENING_HELP_MESSAGE` with `room.localParticipant.sendText(text, { topic: 'lk.chat' })`. `createRoomTokenSource(authorizedFetch, choice)` sends `participant_metadata: JSON.stringify(choice)`. `ConversationPage` gains `onEnded(roomName: string)`, called with `room.name` after "Kết thúc" leaves the room.
- Copy (exact): the status line is `{persona} đang nghe bạn nói.`, `{persona} đang suy nghĩ.`, `{persona} đang nói…`, or `Đang chờ {persona}…`; the in-session view also shows a badge `{title} · tốc độ {label in lowercase}`; the failure banners are "Agent không nghe được bạn vì quyền dùng micro đang bị chặn. Hãy cho phép micro cho trang này trong cài đặt trình duyệt, rồi bấm Bắt đầu.", "Không bắt đầu được buổi luyện. Bấm Bắt đầu để thử lại." and "Agent không sẵn sàng nên buổi luyện đã kết thúc. Bấm Bắt đầu để thử lại.".

- [ ] **Step 1: Write the failing tests**

`scenario-picker.spec.tsx`: `shows three Scenario cards and three speeds with the first Scenario and "Vừa" selected`; `Bắt đầu passes the chosen Scenario and speed` (pick the third card and "Chậm" first). `conversation-page.spec.tsx`: `Bắt đầu requests a Room Token whose participant_metadata carries the chosen Scenario and speed`; `the in-session screen shows the voice bars and two buttons and no conversation text` (no `log` role; the only buttons are "Chưa nghe kịp" and "Kết thúc"; text limited to the badge and the status line); `shows the persona's name in the status line for each Agent state`; `Kết thúc leaves the room and calls onEnded with the room name`; the failure banners in Vietnamese. `listening-help-button.spec.tsx`: `sends the listening help message on lk.chat`.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project frontend apps/frontend/test/scenario-picker.spec.tsx apps/frontend/test/listening-help-button.spec.tsx apps/frontend/test/conversation-page.spec.tsx apps/frontend/test/conversation-page-failures.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** with Astryx components only (check `SelectableCard` and `SegmentedControl` in the Astryx 0.7.17 docs shipped in `node_modules/@astryxdesign/core`); keep the existing voice bars.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project frontend && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend
git commit -m "feat(frontend): pick a Scenario and speed, quiet session screen, help button"
```

### Task 11: Frontend: history and Report pages

**Files:**

- Create: `apps/frontend/src/conversations/conversations-api.ts`, `history-page.tsx`, `report-page.tsx`, `app-nav.tsx`
- Modify: `apps/frontend/src/app.tsx` (routes `/conversations` and `/conversations/:roomName` inside `RequireSignedIn`; `AppNav` as a child of `AppHeader` before `AdminNav`; `ConversationPage` `onEnded` navigates to `/conversations/<roomName>`)
- Test: `apps/frontend/test/conversations-backend.ts` (msw handlers), `history-page.spec.tsx`, `report-page.spec.tsx` (create); update `test/backend.ts` to include the new handlers

**Interfaces:**

- Produces: `fetchConversations(authorizedFetch): Promise<ConversationList>`; `fetchConversation(authorizedFetch, roomName): Promise<ConversationDetail>` (throws `ConversationNotFoundError` on 404); `requestReport(authorizedFetch, roomName): Promise<ReportStatus>`; all parse with the shared schemas.
- `AppNav`: links "Luyện nói" (`/`) and "Lịch sử" (`/conversations`). History page: heading "Lịch sử luyện nói"; a `Table` with columns Ngày, Tình huống, Thời lượng, Báo cáo; each row links to its Report; empty state "Bạn chưa có buổi luyện nào.".
- Report page: on load, calls `requestReport` once when the Conversation has no ready Report, and polls `fetchConversation` every 2000 ms while the status is `generating`. States: loading (`Skeleton`), generating (`Spinner` with "Đang tạo báo cáo…"), failed (`Banner status="error"` "Không tạo được báo cáo." with a "Thử lại" button that calls `requestReport`), not found (`Banner` "Không tìm thấy buổi luyện này."), ready (the layout in Global Constraints). Section empty states: "Bạn không bấm \"Chưa nghe kịp\" lần nào." and "Không tìm thấy lỗi ngữ pháp.". The fluency line is `{wpm} từ/phút · bạn nói {percent}% thời gian · từ đệm khoảng {n} (ước lượng) · lượt dài nhất {s} giây`, with "—" for a null value.

- [ ] **Step 1: Write the failing tests**

`history-page.spec.tsx`: `the history page lists past Conversations, newest first`; `shows the empty state`; `each row links to its Report`. `report-page.spec.tsx`: `asks the backend to make the Report and shows the generating state, then the ready Report` (handlers answer `generating` once, then `ready`); `shows the missed sentences with key phrases in bold and the Vietnamese explanation`; `shows each grammar issue with the wrong sentence struck, the correction and the reason`; `shows the fluency line with an em dash for missing numbers`; `shows the empty states`; `the Report page says the Conversation was not found when the backend answers 404`; `a failed Report shows the error and Thử lại asks again`; `the nav links appear for a signed-in User`.

- [ ] **Step 2: Run and see them fail**

Run: `pnpm exec vitest run --project frontend apps/frontend/test/history-page.spec.tsx apps/frontend/test/report-page.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** with Astryx components (`Card`, `Text`, `Table`, `Spinner`, `Skeleton`, `Banner`, `Button`, `Link`); pagination of the list is the builder's call.

- [ ] **Step 4: Run and see them pass**

Run: `pnpm exec vitest run --project frontend && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend
git commit -m "feat(frontend): history and Report pages"
```

### Task 12: End-to-end scenarios

**Files:**

- Modify: `e2e/playwright.config.ts` (backend env gains `AGENT_API_KEY` and `REPORT_PROVIDER: 'fake'`; agent env gains `BACKEND_URL` and the same `AGENT_API_KEY`, both generated per run like `JWT_SECRET`), `e2e/tests/conversation.spec.ts` (new Vietnamese copy and flow)
- Create: `e2e/tests/listening-roleplay.spec.ts`, `e2e/tests/agent-ingest.ts` (helpers: `roomNameOfToken(jwt: string): string` reads the `video.room` claim; `postTurn(roomName, turn)` and `postMiss` call the backend ingest API with the run's key)

**Interfaces:**

- The fake Provider never speaks, so the tests play the Agent's part by posting Agent and User turns to the ingest API with the run's key; everything else (picking, the real Room Token, LiveKit, the button, End, the Report page) is real. The room name comes from the `/api/token` response seen by `page.waitForResponse`.

- [ ] **Step 1: Write the e2e tests, from the spec's wording**

`a person picks a Scenario and speed and the session shows that Scenario` (register, pick "Họp 1:1 với quản lý" and "Chậm", Bắt đầu; the badge reads "Họp 1:1 với quản lý · tốc độ chậm" and the status line names Alex); `during a session no conversation text appears` (after posting turns, nothing on the page contains their text; only the two buttons exist); `pressing Chưa nghe kịp lists the sentence being said, in the Report` (post an Agent turn, press the button, Kết thúc; the Report page shows that sentence under "Câu bạn nghe sót" with "Giải thích thử nghiệm."); `a wrong sentence appears in the Report with its correction` (post the User turn "I fix it yesterday"; the Report shows it with "I fix it yesterday (đã sửa)"); `an abandoned Conversation still has a Report from the history` (post turns, close the page without Kết thúc, reopen `/conversations`, open the row, see the Report); `a second User cannot open the first User's Report` (sign out, register another User, open the first's URL, see "Không tìm thấy buổi luyện này."). Update `conversation.spec.ts` to the new picker and copy, keeping its microphone-bytes assertion.

- [ ] **Step 2: Run them (Expected: PASS)**

Run: `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-23-listening-roleplay pnpm test:e2e`
Expected: PASS, with the capture under the evidence path.

- [ ] **Step 3: Prove each can fail**

Break the behaviour one test checks (for example make `ListeningHelpButton` send nothing), run `pnpm test:e2e`, expect FAIL for that test, then restore.

- [ ] **Step 4: Run the whole suite again**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test(e2e): listening role-play scenarios"
```
