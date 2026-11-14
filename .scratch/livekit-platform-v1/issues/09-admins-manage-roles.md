# 09: Admins manage Users' Roles

**What to build:** A fresh database gets its first Admin from a seed command. An Admin opens an admin-only Users page, sees every User, and can change any other User's Role between Member and Admin. An Admin can't change their own Role, and nobody can demote the last Admin, so the app always has someone who can manage Users. Members can't see or open the page. Admins can still start Conversations like any Member. See the spec's Backend decisions (Guards, Admin API, Seed) and user stories 41 to 43, 49 to 51.

**Blocked by:** 07 (Register and sign in; Conversations need a signed-in User)

**Status:** ready-for-agent

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
