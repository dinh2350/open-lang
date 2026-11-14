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

## Comments

### 2026-11-14, implementer (branch `ticket/10-lock-and-reset`)

**Result.** Every acceptance criterion is met, on top of the integration branch with ticket 05 merged (`f235c04`). `pnpm check` passes with 258 tests. `pnpm sonar` passes the gate: coverage 96.1% (lines 96.7%, conditions 94.7%), duplication 0.0%, A/A/A, 0 issues. `pnpm test:e2e` passes both tests.

**Security Hotspots: none.** SonarQube reported 0.

**No configuration changes.** ESLint, Prettier, TypeScript, SonarQube and the pnpm build allowlist are unchanged. There are no new dependencies. Developers run `pnpm db:migrate` once to apply `20261114144149_add_user_locked`.

**Decisions to review:**

- **API.** `PUT /api/admin/users/:id/locked` with `{ locked }` returns `200` and that User's details. `PUT /api/admin/users/:id/password` with `{ password }` returns `204`. User details now include `locked`. Messages: `409` `You can't lock yourself.` and `You can't lock the last unlocked Admin.`, `400` `password: Use at least 12 characters for the new password.`
- **The locked `403` carries `errorCode: 'ACCOUNT_LOCKED'`.** This is Nest 12's own `errorCode` exception option, and the shared package exports `ACCOUNT_LOCKED` and `accountLockedResponseSchema`. The message is `Your account is locked. Ask an Admin to unlock it.` The code lets the frontend tell a locked `403` from the Role guard's `403` without matching message text.
- **Changed ticket 09 message.** The demotion `409` now says `You can't demote the last unlocked Admin.`, because the rule counts only unlocked Admins (`lockUnlockedAdmins`: `... WHERE role = 'admin' AND NOT locked FOR UPDATE`).
- **The self rule refuses only locking.** `{ locked: false }` on yourself is a no-op `200`, since a Locked Admin can't call the API anyway. The ticket only names locking.
- **Admins may set their own password** through the Admin API. The spec doesn't forbid it. It revokes their own refresh tokens too, so they have to sign in again after their Auth Token expires.
- **Revocation shares the change's transaction.** Lock and set-password revoke refresh tokens in the same transaction (`revokeAllOf(userId, transaction)`). Locking takes the same unlocked-Admin row locks as Role changes, in READ COMMITTED. As with Role changes, the last-unlocked-Admin rule can only be hit by concurrent requests. The S1 test races two Admins locking each other.
- **Refresh refuses any token of a Locked User** in `RefreshTokenService.rotate`, and revokes the rest of that User's tokens. A lock can miss one token: a refresh that runs at the same moment can insert its new token after the lock's revoke statement took its snapshot. This check covers that case. The S1 test sets up that state by locking the row directly, because the API can't reach it.
- **Sign-in checks the lock only after the password matches.** Someone who doesn't know the password learns nothing about the lock.
- **Frontend.** `authorizedFetch` checks every response. On a `403` with `ACCOUNT_LOCKED`, it forgets the User, which redirects to sign-in, and keeps the message. The sign-in page shows it until the person submits again. Other `403`s don't sign anyone out. The Users page gains a Status column (Active or Locked, plus a Lock or Unlock button; an Admin's own button is disabled with "You can't lock yourself.") and a Password column. "Set new password" opens an inline form that checks the shared 12-character rule before sending. Refusals show inline in the row.
- **The S3 fake** now models Locked Users. Sign-in gets `403`, refresh gets `401`, and `/api/token` and the Admin API run the authentication guard's checks (`401`, or `403` locked). It still leaves the Role guard and the `409` rules to S1.
- **Nothing calls LiveKit's room service.** The backend never removes participants, so a running Conversation continues after a lock.

**Open issues (need a human decision):**

- **A Room Token fetched before the lock can still start one Conversation.** The Conversation page prefetches a Room Token on mount (`useSession`'s `prepareConnection`), and livekit-client caches it until it expires. A User locked after the page loaded who presses Start within that token's 10-minute TTL joins a new room. The backend can't revoke a Room Token it already issued; that is the 10-minute TTL trade-off in the spec. Story 45 ("block new Conversations right away") holds only from the next Room Token on. One option is to refetch a fresh token on Start instead of using the prefetched one. That costs Start some latency and only stops a well-behaved browser.
- **A failed background Room Token refetch is an unhandled rejection.** `@livekit/components-react`'s `useSession` refetches without catching when a Conversation ends (End, or the room disconnecting). For a User locked during a Conversation, that refetch gets the locked `403`. The app still sends them to sign-in with the locked message, but the browser also logs "Uncaught (in promise)". The same happens for any `5xx` or network failure there, so this predates the ticket. Because of it, the S3 test for "any other locked `403`" goes through the Users page, not through ending a Conversation.
