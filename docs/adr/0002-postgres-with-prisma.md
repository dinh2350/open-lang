# Postgres with Prisma for the backend's data

The backend stores Users, Roles, and refresh tokens in Postgres, accessed through Prisma. Postgres runs in the same Docker Compose file as the LiveKit server. Postgres is the default choice for a NestJS service, and Prisma gives typed queries and migrations with a documented NestJS recipe.

## Consequences

- Backend end-to-end tests use a real Postgres through Testcontainers, one database per Vitest worker. The testing research suggested PGlite, which the NestJS docs use, but PGlite's compatibility with Prisma was not verified, so we chose the database we run in production.
