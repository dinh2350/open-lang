# 09: Admins manage Users' Roles

**What to build:** A fresh database gets its first Admin from a seed command. An Admin opens an admin-only Users page, sees every User, and can change any other User's Role between Member and Admin. An Admin can't change their own Role, and nobody can demote the last Admin, so the app always has someone who can manage Users. Members can't see or open the page. Admins can still start Conversations like any Member. See the spec's Backend decisions (Guards, Admin API, Seed) and user stories 41 to 43, 49 to 51.

**Blocked by:** 07 (Register and sign in; Conversations need a signed-in User)

**Status:** done

- [ ] The root script `db:seed` creates an Admin from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` when no Admin exists. It does nothing when one exists.
- [ ] A Role guard restricts admin endpoints to Admins. A Member gets `403`.
- [ ] The guard reads the Role from the database on every request, so a demoted Admin loses access on their next request.
- [ ] Admins can list Users, seeing each one's email, Role and creation date.
- [ ] Admins can change another User's Role.
- [ ] An Admin changing their own Role gets `409`.
- [ ] Demoting the last Admin gets `409`.
- [ ] Admins can request Room Tokens and start Conversations.
- [ ] The frontend has an admin Users page with a table and a Role control.
- [ ] `409` errors are shown inline on that page.
- [ ] Only Admins see the link to the admin page. A Member who opens it directly is redirected.
- [ ] S1 tests cover the seed behavior, the Role guard for both Roles, listing, changing Role, both `409` rules, and loss of access right after demotion.
- [ ] S3 tests cover the Users table, changing a Role, the inline `409`, the hidden link, and redirecting a Member.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.

## Comments

### 2026-11-14, implementer (branch `ticket/09-admin-roles`)

**Result.** Every acceptance criterion is met, on top of the integration branch with tickets 03, 04 and 07 merged (`481224f`). `pnpm check` passes (165 tests). `pnpm sonar` passes the gate: coverage 94.0%, duplication 0.0%, A/A/A, 0 issues. `pnpm test:e2e` passes.

**Security Hotspots: none.** SonarQube reported 0.

**No configuration changes.** ESLint, Prettier, TypeScript, SonarQube and the pnpm build allowlist are unchanged.

**Decisions to review:**

- **API shape.** `GET /api/admin/users` returns `{ users: [{ id, email, role, createdAt }] }`, oldest first. `PUT /api/admin/users/:id/role` with `{ role }` returns `200` and that User's details. Both live in a new Users module (`backend/src/users/`). Messages: `403` `Only Admins can do this.`, `409` `You can't change your own Role.` and `You can't demote the last Admin.`, `404` `No User has this id.`. A User id that isn't a UUID, or an unknown Role, gets `400`.
- **Role guard.** `RoleGuard` with an `@AdminOnly()` decorator (`backend/src/auth/role.guard.ts`) covers the whole admin controller. It reads the Role that ticket 07's global authentication guard loads from the database on every request, so the authentication guard didn't change.
- **The last-Admin rule only matters for concurrent changes.** The Role guard makes sure the caller is an Admin, and the self rule stops them from changing their own Role. So when requests arrive one at a time, demoting another Admin always leaves the caller as an Admin. The rule guards against two Admins demoting each other at the same moment, where each request would otherwise count the other as the remaining Admin, leaving no Admin at all. Each Role change runs in a READ COMMITTED transaction that first locks every Admin's row (`SELECT ... FOR UPDATE` through Prisma's tagged `$queryRaw`, a fixed query with no input). The second change then waits and counts again. The S1 test lines both requests up behind a table lock that the test holds, then releases them. Without the row locks, it fails every time with both demotions succeeding.
- **A request that passed the Role guard just before its Admin was demoted still completes.** Only the last-Admin rule is enforced atomically. For example, if A demotes B while B's request to promote C is in flight, C still becomes an Admin. The next request from B gets `403`.
- **Seed.** `pnpm db:seed` builds the backend with the Nest CLI and runs `dist/seed.js` (`nest start --entryFile seed`), as `pnpm start` does. Node can't run the backend's TypeScript directly, because the imports use `.js` specifiers and the code uses decorators. Like `nest start`, it rebuilds `backend/dist`. The seed checks for an Admin first, so running it on a seeded database needs neither variable. Otherwise it applies the same email and password rules as registering. It logs the new Admin's User id, never the email or password. `backend/.env.example` has `SEED_ADMIN_EMAIL=admin@example.test` and an empty `SEED_ADMIN_PASSWORD`.
- **The seed refuses an email that belongs to a Member** and exits with an error, instead of promoting that Member. Promoting would give Admin rights to whoever registered that email first, with their own password. A human may prefer another behavior.
- **Frontend.** `/admin/users` sits inside `RequireSignedIn` and a new `RequireAdmin`, which sends non-Admins to `/`. An `AdminNav` with "Conversation" and "Manage Users" links shows above the routes for Admins only. The Admin's own Role control is disabled with "You can't change your own Role.", so the self `409` never arrives from the UI. Any refusal, such as the last-Admin `409`, shows inline in that User's row, and the control goes back to the User's Role. Dates use `Intl.DateTimeFormat('en', { dateStyle: 'medium' })` in the browser's time zone.
- **shadcn `table` and `native-select`** were added. `native-select` was edited to use the browser's own arrow instead of a `lucide-react` icon, because `lucide-react` isn't a dependency.

**Open issues:**

- **The S3 redirect test navigates inside the app.** Until ticket 08 keeps Users signed in across reloads, a Member can't open `/admin/users` in a fresh page load while signed in. The test signs in, then navigates with a memory data router. After ticket 08 it can render the app at `/admin/users` directly.
- **The frontend's Role comes from the sign-in response.** A demoted Admin keeps seeing the "Manage Users" link until they sign in again. The page then shows the backend's `403` message.
- **Ticket 10:** the last-Admin rule must count only unlocked Admins; that is one condition on the `lockAdmins` query in `backend/src/users/users.service.ts`.
