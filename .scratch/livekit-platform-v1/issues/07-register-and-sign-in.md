# 07: Register and sign in; Conversations need a signed-in User

**What to build:** A person registers with their email and a password and is signed in right away as a Member. A returning User signs in with the same details. Only a signed-in User can open the Conversation page or get a Room Token, and that User's id becomes their identity in the room. A signed-out person is sent to the sign-in page. Sign-in doesn't survive a reload yet; ticket 08 adds that. See the spec's Backend decisions (Data model, Auth API, Auth Token, Guards, Room Token endpoint), ADR 0002 and ADR 0003.

**Blocked by:** 01 (Anonymous Conversation tracer bullet), 02 (SonarQube quality gate)

**Status:** ready-for-agent

- [ ] Docker Compose also runs Postgres. The backend reaches it through Prisma.
- [ ] The root script `db:migrate` exists.
- [ ] A User has an id, a unique email, an argon2 password hash, a Role (always Member in this ticket), and timestamps.
- [ ] Register takes an email and password, with at least 12 characters and no composition rules. It creates a Member and returns `201` with an Auth Token and the User.
- [ ] Register rejects an invalid email or short password with a clear validation error, and a taken email with a clear `409`.
- [ ] Sign in returns an Auth Token and the User. A wrong email or wrong password gives `401` with the same generic message.
- [ ] A current-User endpoint returns the signed-in User.
- [ ] Register and sign in are each limited to 5 requests per minute per IP.
- [ ] The Auth Token is an HS256 JWT signed with `JWT_SECRET`. It expires after 15 minutes and carries the User id and Role.
- [ ] The authentication guard verifies the Auth Token and loads the User from the database on every request.
- [ ] `/api/token` returns `401` without a valid Auth Token.
- [ ] With a valid Auth Token, the Room Token's participant identity is the User id. Every other Room Token rule from ticket 01 still holds.
- [ ] The frontend has sign-in and register pages and keeps the Auth Token in memory only.
- [ ] A signed-out person who opens the Conversation page is redirected to sign-in.
- [ ] After registering or signing in, the person lands on the Conversation page.
- [ ] S1 tests use Postgres through Testcontainers, with one database per Vitest worker, migrated once, and tables truncated before each test. They cover:
  - register and sign-in rules;
  - the generic error;
  - the rate limits;
  - the current-User endpoint;
  - `/api/token` with and without an Auth Token, checking the identity.
- [ ] S3 tests cover the sign-in and register flows and errors, and the signed-out redirect, with MSW serving `/api`.
- [ ] The S4 smoke test now registers a new User before pressing Start.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.
