# 08: Stay signed in across reloads, and sign out

**What to build:** A User stays signed in across page reloads for up to 7 days, without entering their password again. A User can sign out, which revokes their session on the server so nobody can reuse it from that browser. A stolen refresh token that has already been used stops working, and using it again signs that User out everywhere. See the spec's Backend decisions (Auth API, Refresh token) and ADR 0003.

**Blocked by:** 07 (Register and sign in; Conversations need a signed-in User)

**Status:** ready-for-agent

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
