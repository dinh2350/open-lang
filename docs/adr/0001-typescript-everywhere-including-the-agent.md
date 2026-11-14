# TypeScript everywhere, including the Agent

The frontend, backend, and Agent all live in one pnpm workspace and are all written in TypeScript. The Agent uses LiveKit's Node.js framework (`@livekit/agents`) instead of the Python one. Python is LiveKit's default and has the biggest plugin ecosystem, but the team works in TypeScript, and one language lets the three apps share types (such as the token API contract) through a `shared/` package.

## Consequences

- Some LiveKit plugins and features ship for Python first, or only for Python. Check Node support before choosing an AI provider or agent feature.
- Moving the Agent to Python later means rewriting it, and the shared types stop covering it.
