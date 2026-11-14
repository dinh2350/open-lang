# Coding Standards

These rules apply to everyone who writes code in this repo, human or AI. Tools enforce the mechanical rules: Prettier, ESLint, `tsc` and SonarQube, through `pnpm check` and `pnpm sonar`. This file holds the rules for working with those tools, plus the judgement rules that `/code-review` checks and tools can't.

## Quality gates are fixed in code, never in config

- When a scanner reports a problem, change the code so the problem is gone. Never silence the scanner.
- Never add `@ts-ignore`, `@ts-nocheck` or `// NOSONAR`.
- An ESLint disable comment must target a single rule on a single line and give a description explaining why the rule is wrong *here*. Such a comment is a code-review finding unless the reason holds up.
- `@ts-expect-error` is allowed only with a description, and only when a third-party type is provably wrong.
- Don't loosen ESLint, Prettier, TypeScript or SonarQube configuration, don't add analysis or coverage exclusions, and don't lower thresholds without a human's explicit approval. Record that approval in the ticket's `## Comments`.
- Only a human may mark a SonarQube Security Hotspot as safe. An agent lists new hotspots in the ticket's `## Comments` and stops.
- `pnpm check` must pass, with zero warnings, before a ticket is done. From ticket 02 on, `pnpm sonar` must pass too.

## Language and naming

- Use the vocabulary in `GLOSSARY.md` for names of types, functions, variables, files, tests and log fields. Write `User`, `Conversation`, `AuthToken`, `RoomToken`, `AgentMode` and `Provider`. Don't use the synonyms the glossary lists under *Avoid* (for example `session` for Conversation, or a bare `accessToken`).
- When a decision contradicts an ADR in `docs/adr/`, say so explicitly in the ticket. Don't silently diverge.

## TypeScript

- Prefer `unknown` over `any`, and narrow it with zod schemas or type guards.
- Validate data crossing a process boundary (HTTP bodies, environment variables, token claims) at that boundary with zod. Inside the boundary, trust the types.
- Request and response shapes shared between frontend and backend live only in the `shared` package. Never redeclare them per app.
- Prefer small modules with a narrow interface and the logic behind it. Don't export helpers just so tests can reach them.

## Errors and security

- Don't swallow errors. Handle an error where something useful can be done about it; otherwise let it propagate to the framework's error handling.
- Never log secrets, passwords, Auth Tokens, Room Tokens, refresh tokens, or API keys. Log User ids, not emails.
- Secrets come only from environment variables, never from source code or committed files.
- Authorization decisions happen in backend guards, which load the User from the database. The frontend only hides UI; it never enforces access.

## Tests

- Test through the agreed seams (S1 backend HTTP API, S2 Agent configuration and session, S3 frontend routes, S4 whole system), as described in the spec. Assert on behavior a caller can observe, not on private functions or call order.
- Don't mock the module you are testing, and don't mock NestJS guards outside tests that are explicitly about something else.
- Fast tests (`pnpm test`) never need provider API keys or a running LiveKit server. Tests that do belong in `test:live` or `test:e2e`.
- A coverage gap is closed by testing behavior, not by excluding files.
