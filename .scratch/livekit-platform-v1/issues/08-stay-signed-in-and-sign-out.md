# 08: Stay signed in across reloads, and sign out

**What to build:** A User stays signed in across page reloads for up to 7 days, without entering their password again. A User can sign out, which revokes their session on the server so nobody can reuse it from that browser. A stolen refresh token that has already been used stops working, and using it again signs that User out everywhere. See the spec's Backend decisions (Auth API, Refresh token) and ADR 0003.

**Blocked by:** 07 (Register and sign in; Conversations need a signed-in User)

**Status:** done

- [ ] A refresh token record stores the User, a hash of the token, an expiry 7 days out, a revoked-at time, and the token it replaced.
- [ ] Register and sign in set an opaque refresh token in an httpOnly, `SameSite=Strict` cookie scoped to the auth routes.
- [ ] Refresh reads the cookie, rotates the token by revoking the old one and setting a new one, and returns a new Auth Token.
- [ ] Refresh returns `401` when the cookie is missing, expired or revoked.
- [ ] Presenting a refresh token that was already rotated revokes all of that User's refresh tokens and returns `401`.
- [ ] Sign out revokes the current refresh token, clears the cookie, and returns `204`.
- [ ] On load, the frontend calls refresh to get an Auth Token. If that fails, it treats the person as signed out.
- [ ] When an API call returns `401`, the frontend tries one refresh and retries the call. If the refresh also fails, it sends the person to sign-in.
- [ ] The app has a sign-out control.
- [ ] S1 tests cover rotation, expiry, reuse detection revoking every refresh token of that User, and sign-out revocation.
- [ ] S3 tests cover staying signed in after a reload, the single-retry-then-sign-in behavior, and sign-out.
- [ ] Definition of done: `pnpm check` passes, and `pnpm sonar` passes the SonarQube quality gate. Fix the code itself; never add suppression comments, loosen rules, or lower thresholds (see `CODING_STANDARDS.md`). Any new Security Hotspot is listed under `## Comments` in this file for a human to review.

## Comments

### 2026-11-14, implementer (branch `ticket/08-stay-signed-in`)

**Result.** Every acceptance criterion is met, on top of the integration branch with tickets 03 and 09 merged (`1ead97b`). Results of `pnpm check`, `pnpm sonar` and `pnpm test:e2e` are in the final paragraph.

**Security Hotspots: none.** SonarQube reported 0. The cookie is set with `httpOnly`, `secure` and `sameSite` explicitly, so Sonar's cookie rules have nothing to flag.

**Needs human approval:** nothing. No lint, format, TypeScript or SonarQube configuration changed. One new backend dependency: `cookie@^2.0.2` (Express's own cookie library, newer major), used to read the `Cookie` header and, in tests, to parse `Set-Cookie`.

**Decisions to review:**

- **API.** `POST /api/auth/refresh` returns `200` with the same body as sign-in, `{ authToken, user }`, so the app learns the User on load without calling `/me`. `POST /api/auth/sign-out` returns `204`. Both are `@Public()`: they use the cookie, not the Auth Token, so a User whose Auth Token expired can still refresh and sign out.
- **Cookie.** `refresh_token`, `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800`. `Secure` works on `http://localhost` in Chromium (the new S4 test proves it through the Vite proxy) and in Firefox. Not verified: Safari may not store a `Secure` cookie from `http://localhost`. If so, developers on Safari are signed out by a reload. Production must use HTTPS anyway.
- **Expiry slides (needs a human decision).** Each rotation issues a token with a fresh 7 days, as the ticket's "an expiry 7 days out" reads. A User active at least once a week therefore stays signed in indefinitely. If "up to 7 days" means a cap counted from sign-in, the new token should copy the old token's `expiresAt`. That is a one-line change in `RefreshTokenService.rotate`.
- **Storage.** The token is 32 random bytes (base64url). Only its SHA-256 is stored. A fast hash suffices for a 256-bit random value; argon2 isn't needed. The `RefreshToken` table has `userId` (cascade delete), unique `tokenHash`, `expiresAt`, `revokedAt` and unique `replacesId` (the token it replaced), plus an index on `userId`. Developers run `pnpm db:migrate` once to apply it.
- **Reuse detection.** Only a token that was rotated (one that has a replacement) revokes every refresh token of its User. A token revoked by sign-out just gets `401`. Reuse is checked before expiry, so an expired rotated token still counts as reuse, which is the literal reading of the ticket. Rotation is a conditional update inside a transaction. Of two concurrent refreshes with the same token, one rotates it and the other counts as reuse, and the S1 test for that is deterministic.
- **Sign-out** revokes only this browser's token; the User's other devices stay signed in. With a missing or unknown cookie it still returns `204` and clears the cookie. A refresh that fails with `401` does not clear the cookie.
- **Frontend.** `AuthProvider` refreshes once on load. `RequireSignedIn` renders nothing until that answers. A refresh that fails for any reason (`401`, `5xx`, network) counts as signed out. All refreshes in a tab share one in-flight request. Otherwise React StrictMode's doubled effect would send the same cookie twice in dev and sign the User out everywhere; an S3 test through `main.tsx` guards that. `authorizedFetch` retries a `401` once after a refresh, so request bodies must be re-sendable (all are strings today). When sign-out fails, the User stays signed in and sees "Couldn't sign out. Try again."
- **Merging with ticket 09.** Both tickets put a fixed bar at the top right, so the bars overlapped for Admins. `App` now renders one `SignedInHeader` holding `AdminNav` and the Sign out button, and `AdminNav` no longer positions itself. Ticket 09's "Member opens the Users page" S3 test now opens `/admin/users` as a page load with the Member's refresh cookie, instead of using a memory router.
- **Tests.** The S3 fake backend keeps the browser's refresh cookie in module state, because jsdom's `fetch` keeps no cookies. It models rotation, reuse detection, sign-out, and Auth Tokens that expire after 15 minutes; `/api/token` answers `401` to an expired Auth Token. Expiry tests move the clock with `vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })`.
- **S4.** The new test `e2e/tests/stay-signed-in.spec.ts` registers, reloads and is still signed in, then signs out and opens the app signed out. `registerNewUser` moved to `e2e/tests/users.ts` and now waits for the Register heading. The router renders the new page asynchronously, and the new test caught Playwright filling the sign-in form's fields instead; the smoke test had the same race.

**Open issues:**

- **Two tabs refreshing at once sign the User out everywhere (needs a human decision).** Both tabs send the same cookie, for example after reloading both or after both hit a `401` past 15 minutes, and the second counts as reuse. Single-flight works only within one tab. There are two ways out:
  - A short grace window: the backend accepts a just-rotated token for a few seconds and returns its successor. This weakens reuse detection.
  - Cross-tab coordination in the frontend, such as the Web Locks API.
- **Ticket 10.** Refresh must answer `401` for a Locked User, and locking or resetting a password must call `RefreshTokenService.revokeAllOf(userId)`. AuthModule doesn't export the service yet; ticket 10 adds `exports: [RefreshTokenService]`.
- **Refresh-token rows are never deleted.** An active User adds one row about every 15 minutes, since the app refreshes on the first `401` after the Auth Token expires. A periodic delete of expired rows can come later.
- **No proactive refresh.** The app refreshes only on a `401`, so the first request after 15 minutes costs one extra round trip.

**Final results** (code at `4547cb5`, with ticket 09 merged): `pnpm check` passes with 190 tests. `pnpm sonar` passes the gate: coverage 95.2% (lines 96.0%, conditions 93.0%), duplication 0.0%, A/A/A, 0 issues, 0 Security Hotspots. `pnpm test:e2e` passes both tests: the smoke test, and staying signed in across a reload and then signing out.
