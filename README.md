# LiveKit Platform

A web app where a person talks out loud with an AI voice Agent from the browser. It is a pnpm monorepo with five packages: `frontend` (React), `backend` (NestJS), `agent` (LiveKit Agents for Node), `shared` (contracts) and `e2e` (Playwright). A self-hosted LiveKit server runs in Docker. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for the decisions.

## Getting started

Use Node 24 (`.nvmrc`) and pnpm 10 (`corepack enable pnpm`), then:

```sh
pnpm install
cp backend/.env.example backend/.env
cp agent/.env.example agent/.env
cp frontend/.env.example frontend/.env
docker compose up --detach --wait   # the LiveKit server
pnpm dev                            # frontend, backend and Agent
```

## Commands

| Command                                 | What it does                                                      |
| --------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                              | Runs the frontend, backend and Agent with hot reload.             |
| `pnpm test`                             | Runs every fast test with coverage. Needs no keys and no LiveKit. |
| `pnpm test:e2e`                         | Runs the end-to-end smoke test against Docker Compose.            |
| `pnpm check`                            | Format check, lint, typecheck and tests.                          |
| `pnpm sonar:up`, `sonar:setup`, `sonar` | The local SonarQube quality gate.                                 |

## Quality gates

Every change passes three layers of checks: a hook on every edit, `pnpm check` on every commit, and the SonarQube gate on every ticket. Only a human may mark a SonarQube Security Hotspot as safe. See [docs/quality-gates.md](docs/quality-gates.md) and `CODING_STANDARDS.md`.
