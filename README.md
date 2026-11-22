# Open Lang

A web app where a person talks out loud with an AI voice Agent from the browser. It is a pnpm monorepo with five packages: `frontend` (React), `backend` (NestJS), `agent` (LiveKit Agents for Node), `shared` (contracts) and `e2e` (Playwright). A self-hosted LiveKit server runs in Docker. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for the decisions.

## Getting started

Use Node 24 (`.nvmrc`) and pnpm 10 (`corepack enable pnpm`), then:

```sh
pnpm install                        # also generates the Prisma client
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env   # then set JWT_SECRET (openssl rand -base64 48) and SEED_ADMIN_PASSWORD
cp apps/agent/.env.example apps/agent/.env
cp apps/frontend/.env.example apps/frontend/.env
docker compose up --detach --wait   # the LiveKit server and Postgres
pnpm db:migrate                     # creates the tables
pnpm db:seed                        # creates the first Admin
pnpm dev                            # frontend, backend and Agent
```

Open http://localhost:5173 and register, or sign in as the first Admin (`SEED_ADMIN_EMAIL`) to manage Users. If another Postgres already uses port 5432, set `POSTGRES_PORT` in `.env` and the same port in `DATABASE_URL` in `apps/backend/.env`.

The example Agent config uses the `fake` Provider, which needs no API key and stays silent. To talk with the Agent, set `REALTIME_PROVIDER` in `apps/agent/.env` to `openai` with `OPENAI_API_KEY`, or to `google` with `GOOGLE_API_KEY` or Vertex AI (see `apps/agent/.env.example`). To try Pipeline mode instead, set `AGENT_MODE=pipeline` and choose `openai` or `google` for each of `STT_PROVIDER`, `LLM_PROVIDER` and `TTS_PROVIDER`; the Providers may be mixed. The Agent refuses to start, naming the variable, when its configuration is invalid.

## Commands

| Command                                 | What it does                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                              | Runs the frontend, backend and Agent with hot reload.                                                                                                     |
| `pnpm test`                             | Runs every fast test with coverage. Needs Docker for the backend's Postgres (Testcontainers), but no keys and no LiveKit.                                 |
| `pnpm test:e2e`                         | Runs the end-to-end smoke test against Docker Compose.                                                                                                    |
| `pnpm test:live`                        | Runs live Agent tests against real Providers; skipped without keys.                                                                                       |
| `pnpm db:migrate`                       | Regenerates the Prisma client and runs `prisma migrate dev`: applies migrations, and creates one after a schema change (`pnpm db:migrate --name <name>`). |
| `pnpm db:seed`                          | Creates the first Admin from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `apps/backend/.env`. Does nothing once an Admin exists.                      |
| `pnpm check`                            | Format check, lint, typecheck and tests.                                                                                                                  |
| `pnpm sonar:up`, `sonar:setup`, `sonar` | The local SonarQube quality gate.                                                                                                                         |

## Quality gates

Every change passes three layers of checks: a hook on every edit, `pnpm check` on every commit, and the SonarQube gate on every ticket. Only a human may mark a SonarQube Security Hotspot as safe. See [docs/quality-gates.md](docs/quality-gates.md) and `CODING_STANDARDS.md`.
