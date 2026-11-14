# 20: Check that Safari keeps the refresh cookie on localhost

**What to build:** Ticket 08 noted that Safari may not keep a `Secure` cookie on `http://localhost`. That was never verified. If Safari drops it, Users in Safari are signed out on every reload during development.

**Blocked by:** None (can start immediately).

**Status:** needs-triage

- [ ] Verify in Safari, or with Playwright's WebKit, whether a reload keeps the User signed in.
- [ ] If it doesn't, propose a dev-only cookie setting for a human to approve.
