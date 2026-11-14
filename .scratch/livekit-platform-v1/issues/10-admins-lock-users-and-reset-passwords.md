# 10: Admins lock Users and reset passwords

**What to build:** An Admin can lock a User, which blocks them right away. A Locked User can't sign in, call the backend, refresh their session or start a new Conversation, and they see a clear "account locked" message. A Conversation already running continues until it ends. An Admin can unlock the User again. An Admin can also set a new password for a User who forgot theirs, which signs that User out everywhere. An Admin can't lock themselves, and nobody can lock the last unlocked Admin. See the spec's Backend decisions (Auth API, Guards, Admin API) and the glossary entry for Locked User.

**Blocked by:** 08 (Stay signed in across reloads, and sign out), 09 (Admins manage Users' Roles)

**Status:** ready-for-agent

- [ ] A User has a locked flag, false by default.
- [ ] Admins can lock and unlock another User. Locking revokes all of that User's refresh tokens.
- [ ] An Admin locking themselves gets `409`.
- [ ] Locking the last unlocked Admin gets `409`.
- [ ] The last-Admin rule from ticket 09 now counts only unlocked Admins.
- [ ] Locked User signing in:
  - with the correct password gets `403` with an "account locked" message;
  - with a wrong password gets the same generic `401` as anyone else.
- [ ] Locked User with an existing session:
  - any authenticated request gets `403` (because the guard loads the User on every request), and that includes `/api/token`;
  - refresh gets `401`.
- [ ] A Locked User's running Conversation isn't ended. The backend never removes participants from rooms.
- [ ] Admins can set a new password for another User, with the same 12-character minimum. This revokes all of that User's refresh tokens.
- [ ] The admin Users page shows each User's locked state and has lock, unlock, and set-new-password actions. `409` errors are shown inline.
- [ ] The sign-in page shows the "account locked" message on `403`. Any other `403` locked response sends the person to sign-in with that message.
- [ ] S1 tests cover:
  - locking and unlocking;
  - refresh token revocation on lock and on password reset;
  - the Locked User responses on sign-in, authenticated calls, refresh and `/api/token`;
  - both `409` rules;
  - signing in with the new password after a reset.
- [ ] S3 tests cover the lock, unlock and set-password actions, the inline `409`, and the locked message on sign-in.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.
