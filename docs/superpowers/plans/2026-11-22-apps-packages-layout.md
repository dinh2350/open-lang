# Apps and Packages Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `agent`, `backend` and `frontend` into `apps/` and `shared` into `packages/`, leaving `e2e/` at the root, with no change in behavior.

**Architecture:** Whole directories move with `git mv`. The workspace file, each moved package's `tsconfig.json`, and the root tooling that hard-codes the old paths (Vitest, ESLint, Sonar, the lcov split script, `.gitignore`) are repointed in the same commit, so every commit is green. Docs and comments that name the old paths follow in a second commit. The existing test suites, Sonar and a stale-path search are the proof.

**Tech Stack:** pnpm workspaces, Vitest, ESLint, Prettier, TypeScript, SonarQube, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-22-apps-packages-layout-design.html`

## Global Constraints

- Moves only: no code changes inside any package; package names `@open-lang/*` and imports do not change.
- Target layout: `apps/agent`, `apps/backend`, `apps/frontend`, `packages/shared`; `e2e/` stays at the repository root.
- The four moved packages extend `../../tsconfig.base.json`; `e2e` keeps `../tsconfig.base.json`.
- Use `git mv` on whole directories, so history follows and ignored files such as `.env` move with them. Re-run `pnpm install` afterwards.
- No Turborepo or Nx, and `shared` is not split.
- Fix the code, never the scanner: no `NOSONAR`, `@ts-ignore`, ESLint or Sonar exclusions, or lowered thresholds (CLAUDE.md). The only Sonar and ESLint path edits are re-pointing existing entries.
- Before the work is done, `pnpm check`, `pnpm sonar` and `pnpm test:e2e` must all pass.
- Specs, plans and evidence stay in `docs/superpowers/`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Test Strategy

No new tests are written, as the spec says: behavior does not change, so the existing suites prove it, plus the path checks named in the tasks.

| Scenario                                                                                                   | Unit                                                                          | Integration                                                    | E2E                                                                 |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Every app and the shared package still work: all suites pass, 41 files and 466 tests as before the move    | the agent, frontend and scripts specs inside `pnpm test` (Task 1)             | the backend specs against Postgres inside `pnpm test` (Task 1) | `conversation.spec.ts` and `stay-signed-in.spec.ts` (Task 3)        |
| Sonar still scans all four source packages and the e2e tests, and coverage reaches it for each of the four | `pnpm test` writes `lcov.info` for each of the four, none in `apps/` (Task 1) | `pnpm sonar` passes and analyzes 143 files (Task 3)            | —                                                                   |
| `pnpm dev` starts the backend, frontend and agent                                                          | `pnpm typecheck` (Task 1)                                                     | the three health URLs answer (Task 3)                          | `conversation.spec.ts` starts all three from the new paths (Task 3) |
| No reference to the old paths remains in docs, comments or config                                          | stale-path search, empty output (Task 2)                                      | `pnpm format:check` and `pnpm lint` (Task 2)                   | —                                                                   |

Rows 2 and 4 are checks on tooling and text with no browser flow, so their E2E cell is `—`; the E2E level is covered by rows 1 and 3.

**Unit run:** `pnpm test`
**Integration run:** `pnpm vitest run --project backend`
**E2E run:** `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-22-apps-packages-layout pnpm test:e2e`
**E2E evidence:** `docs/superpowers/evidence/2026-11-22-apps-packages-layout/` — the Playwright video, screenshot and trace of every test, plus the saved output of `pnpm sonar` and the `pnpm dev` health checks.

## Quality Gates

All five are whole-project. The Build line names the frontend because it is the only package with a `build` script; the root has none and there is no CI. At the base commit `8982e67`, format, lint, typecheck, the unit and integration suites (41 files, 466 tests), `pnpm test:e2e` (2 tests) and `pnpm sonar` (143 files analyzed, gate passed) were all green, so nothing is scoped to changed files.

**Format run:** `pnpm format:check`
**Lint run:** `pnpm lint`
**Typecheck run:** `pnpm typecheck`
**Build run:** `pnpm --filter @open-lang/frontend build`
**Sonar run:** `pnpm sonar`

## Review Focus

1. The lcov split script takes the first path segment as the package, so after the move all three apps would merge into one `apps/coverage/lcov.info` and Sonar would lose their coverage. Pinned in Task 1, Step 8.
2. A root Vitest glob that no longer matches `scripts/vitest.config.ts` or a package drops its tests while `pnpm test` still passes. Pinned in Task 1, Step 7: the totals must stay 41 files and 466 tests.
3. The ESLint globs for `backend/**` and `frontend/**` stop matching, which silently turns off the NestJS and React/a11y rules. Pinned in Task 1, Step 9.
4. `.gitignore` still ignores `backend/src/generated/`, so the generated Prisma client shows up as untracked. Pinned in Task 1, Step 10.
5. A Sonar path that no longer matches drops a package from the scan while the gate still passes. Pinned in Task 3, Step 3: it must analyze 143 files, as at the base.

---

### Task 1: Move the packages and repoint the tooling

**Files:**

- Move: `agent`, `backend`, `frontend` to `apps/`; `shared` to `packages/`
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/agent/tsconfig.json`, `apps/backend/tsconfig.json`, `apps/frontend/tsconfig.json`, `packages/shared/tsconfig.json` (line 2)
- Modify: `vitest.config.ts`, `eslint.config.ts:60,69`, `sonar-project.properties:6-18`, `scripts/split-lcov-by-package.ts:25`, `.gitignore:8`
- Modify: `pnpm-lock.yaml` (regenerated by `pnpm install`)

**Interfaces:**

- Consumes: nothing.
- Produces: packages at `apps/agent`, `apps/backend`, `apps/frontend`, `packages/shared`, unchanged names. `pnpm test` writes `apps/<name>/coverage/lcov.info` and `packages/shared/coverage/lcov.info`. Task 2 and Task 3 rely on these paths.

- [ ] **Step 1: Commit the approved spec and this plan**

```bash
git add docs/superpowers/specs/2026-11-22-apps-packages-layout-design.html docs/superpowers/plans/2026-11-22-apps-packages-layout.md
git commit -m "docs: spec and plan for the apps and packages layout"
```

- [ ] **Step 2: Write the failing check**

Run: `pnpm ls -r --depth -1 --parseable | grep -cE '/(apps/(agent|backend|frontend)|packages/shared|e2e)$'`
Expected: `1` (only `e2e` matches). It must read `5` when the task is done.

- [ ] **Step 3: Move the directories**

```bash
mkdir -p apps packages
git mv agent backend frontend apps/
git mv shared packages/
```

Check that ignored files travelled with them: `ls apps/agent/.env apps/backend/.env apps/frontend/.env`
Expected: all three exist. If one is missing, copy it from where it was; never recreate it by hand.

- [ ] **Step 4: Point the workspace at the new directories**

In `pnpm-workspace.yaml`, the `packages:` list becomes `apps/*`, `packages/*`, `e2e`. Leave `catalog`, `onlyBuiltDependencies` and `ignoredBuiltDependencies` as they are.

- [ ] **Step 5: Fix the four `tsconfig.json` files**

In `apps/agent`, `apps/backend`, `apps/frontend` and `packages/shared`, change `"extends": "../tsconfig.base.json"` to `"../../tsconfig.base.json"`. Leave `e2e/tsconfig.json` alone.

- [ ] **Step 6: Reinstall and check the workspace**

Run: `pnpm install`
Expected: succeeds; `pnpm-lock.yaml` importers are now keyed `apps/agent`, `apps/backend`, `apps/frontend`, `packages/shared`.

Run: `pnpm ls -r --depth -1 --parseable | grep -cE '/(apps/(agent|backend|frontend)|packages/shared|e2e)$'`
Expected: `5`

- [ ] **Step 7: Repoint Vitest, then run the suites**

In `vitest.config.ts`: `projects` becomes `['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts', 'scripts/vitest.config.ts']` (the `scripts` entry is needed: it was matched by the old `*/vitest.config.ts`). `coverage.include` becomes `['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}']`. If Vitest errors on the `packages/*` entry because nothing matches it today, drop that one entry and say so in the commit message.

Run: `pnpm vitest run`
Expected: `Test Files  41 passed (41)` and `Tests  466 passed (466)`, the same totals as before the move.

- [ ] **Step 8: Repoint the lcov split script and check its output**

In `scripts/split-lcov-by-package.ts`, replace the package-directory line (25, `sourceFile.split('/')[0] ?? ''`) so the package directory is the first two segments of the source path, for example `apps/backend` or `packages/shared`. Update the header comment so it says reports land in `<package directory>/coverage/lcov.info`.

Run: `pnpm test && ls apps/agent/coverage/lcov.info apps/backend/coverage/lcov.info apps/frontend/coverage/lcov.info packages/shared/coverage/lcov.info && test ! -e apps/coverage && echo no-merged-apps-report`
Expected: the four paths are listed, then `no-merged-apps-report`.

- [ ] **Step 9: Repoint ESLint and check the rules still apply**

In `eslint.config.ts`, `files: ['backend/**/*.ts']` becomes `['apps/backend/**/*.ts']` and `files: ['frontend/**/*.{ts,tsx}']` becomes `['apps/frontend/**/*.{ts,tsx}']`. The `ignores: ['e2e/**']` line stays.

Run: `pnpm exec eslint --print-config apps/backend/src/app.module.ts | grep -c allowWithDecorator`
Expected: `1` or more.

Run: `pnpm exec eslint --print-config apps/frontend/src/main.tsx | grep -c 'react-hooks/rules-of-hooks'`
Expected: `1` or more.

- [ ] **Step 10: Repoint Sonar and `.gitignore`**

In `sonar-project.properties`: `sonar.sources` becomes `packages/shared/src,apps/backend/src,apps/agent/src,apps/frontend/src`; `sonar.tests` becomes `apps/backend/test,apps/agent/test,apps/frontend/test,e2e`; `sonar.javascript.lcov.reportPaths` becomes the four `apps/<name>/coverage/lcov.info` and `packages/shared/coverage/lcov.info` paths. Leave the `e2e` exclusion lines and `**/generated/**` as they are, and update the first comment so it lists the new directories.

In `.gitignore`, line 8 becomes `apps/backend/src/generated/`.

Run: `git check-ignore -v apps/backend/src/generated/client.ts`
Expected: prints the `.gitignore` rule that matches.

- [ ] **Step 11: Run the project gates**

Run: `pnpm check`
Expected: format, lint, typecheck and tests all pass; totals 41 files, 466 tests.

Run: `git status --short`
Expected: renames and the edits above only. No `??` entry other than `docs/superpowers/evidence/`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: move the apps into apps/ and shared into packages/"
```

---

### Task 2: Update the docs and comments

**Files:**

- Modify: `README.md` (lines 12-14, 21, 23, 34), `docker-compose.yml:42`, `.env.example:6,23`
- Modify: `apps/agent/AGENTS.md:35`, `apps/agent/scenarios.yaml:1`
- Modify: `apps/agent/test/live/realtime-openai.spec.ts`, `pipeline-openai.spec.ts`, `pipeline-google.spec.ts`, `realtime-google.spec.ts` (comments)
- Modify: `apps/frontend/test/app.tsx:16`, `apps/frontend/src/vite-env.d.ts:1`, `apps/backend/test/structure.spec.ts:8` (comments)

**Interfaces:**

- Consumes: the new layout from Task 1.
- Produces: no reference to the old paths outside the history records. Task 3 relies on the search below returning nothing.

- [ ] **Step 1: Write the failing check**

Run:

```bash
grep -rnE '(^|[^A-Za-z0-9_./@-])(agent|backend|frontend|shared)/[A-Za-z.]' . -I --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=coverage --exclude-dir=dist --exclude-dir=.scannerwork --exclude-dir=test-results --exclude-dir=skills --exclude-dir=superpowers --exclude-dir=.superpowers --exclude=pnpm-lock.yaml --exclude=analysis.spec.ts
```

Expected: about twenty lines, from the files listed above. This is the red state.

- [ ] **Step 2: Rewrite the `.env` references**

Prefix every `backend/.env`, `agent/.env` and `frontend/.env` (including `.env.example`) with `apps/`, in the files listed above. The pattern skips text that already has a `/` before it, so running it twice changes nothing more:

```bash
sed -i '' -E 's#(^|[^/A-Za-z])((backend|agent|frontend)/\.env)#\1apps/\2#g' README.md docker-compose.yml .env.example apps/frontend/test/app.tsx apps/frontend/src/vite-env.d.ts apps/agent/test/live/*.spec.ts
```

- [ ] **Step 3: Rewrite the remaining mentions by hand**

- `apps/agent/AGENTS.md:35` and `apps/agent/scenarios.yaml:1`: `--scenarios agent/scenarios.yaml` becomes `--scenarios apps/agent/scenarios.yaml` (the command runs from the repository root).
- `apps/backend/test/structure.spec.ts:8`: the comment's `backend/src` becomes `apps/backend/src`.

My call: `scripts/sonar/test/analysis.spec.ts` keeps its `backend/src/...` strings; they are sample report data, not paths this repository reads.

- [ ] **Step 4: Run the check to verify it passes**

Run the Step 1 search again.
Expected: no output.

Run: `pnpm format:check && pnpm lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: point docs and comments at the apps/ and packages/ paths"
```

---

### Task 3: End-to-end scenarios

No production code. The existing end-to-end tests and Sonar are the scenarios.

**Files:**

- Test: `e2e/tests/conversation.spec.ts`, `e2e/tests/stay-signed-in.spec.ts` (unchanged)
- Evidence: `docs/superpowers/evidence/2026-11-22-apps-packages-layout/`

**Interfaces:**

- Consumes: the new layout from Tasks 1 and 2.
- Produces: the evidence directory read by verification-before-completion.

- [ ] **Step 1: Run the end-to-end tests**

Run: `E2E_EVIDENCE_DIR=docs/superpowers/evidence/2026-11-22-apps-packages-layout pnpm test:e2e`
Expected: `2 passed`, and the directory above holds a video, screenshot and trace for each test.

- [ ] **Step 2: Prove the e2e run can fail**

In `e2e/playwright.config.ts`, change the agent's `command` to `pnpm --filter @open-lang/agent-missing start`.

Run: `pnpm test:e2e`
Expected: FAIL: the agent web server does not start.

Restore: `git checkout -- e2e/playwright.config.ts`

- [ ] **Step 3: Run Sonar and keep its output**

Run: `pnpm sonar 2>&1 | tee docs/superpowers/evidence/2026-11-22-apps-packages-layout/sonar.txt | tail -5`
Expected: `Quality gate passed.`

Run: `grep -E 'out of [0-9]+' docs/superpowers/evidence/2026-11-22-apps-packages-layout/sonar.txt`
Expected: `out of 143`, the same count as at the base commit. A smaller number means a package fell out of the scan.

- [ ] **Step 4: Check that `pnpm dev` starts all three apps**

Prerequisite: the Compose stack is up (`docker compose up --detach --wait`, which `pnpm test:e2e` already did). If the backend reports a missing database, run `pnpm db:migrate` once and retry.

```bash
pnpm dev > docs/superpowers/evidence/2026-11-22-apps-packages-layout/dev.txt 2>&1 & dev=$!
for u in http://localhost:3000/api/health http://localhost:8081 http://localhost:5173; do
  for i in $(seq 60); do curl -fsS -o /dev/null "$u" && break; sleep 1; done
  curl -fsS -o /dev/null -w "$u %{http_code}\n" "$u"
done | tee docs/superpowers/evidence/2026-11-22-apps-packages-layout/dev-health.txt
kill -INT $dev; sleep 3; lsof -i :3000 -i :5173 -i :8081
```

Expected: three lines ending `200`, then `lsof` prints nothing.

- [ ] **Step 5: Run every gate once more**

Run: `pnpm check`
Expected: pass.

Run: `pnpm --filter @open-lang/frontend build`
Expected: succeeds.

- [ ] **Step 6: Commit the evidence**

```bash
git add docs/superpowers/evidence/2026-11-22-apps-packages-layout
git commit -m "test: evidence that the apps and packages layout works"
```
