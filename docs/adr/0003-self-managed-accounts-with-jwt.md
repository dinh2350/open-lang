# Self-managed accounts with JWT, no SSO

The backend owns User accounts itself. Users register and sign in with email and password, and the password is hashed with argon2. The backend then issues its own JWTs. We chose this over SSO through an external identity provider such as Microsoft Entra ID, because the app must not care whether a User is internal or external to the company. Owning accounts also keeps authentication within one service we control.

## Token model

- **Auth Token:** an HS256 JWT signed with `JWT_SECRET`. It expires after 15 minutes, and the frontend holds it in memory only.
- **Refresh token:** expires after 7 days, is rotated on every use, and travels in an httpOnly cookie. It is stored hashed in Postgres so it can be revoked. Locking a User revokes their refresh tokens.
- **Libraries:** `@nestjs/jwt` with hand-written guards. We did not use the first-party `@nestjs/authentication` and `@nestjs/authorization` packages because they are still 0.x.

## Consequences

- We must build password reset, account locking, and Role management ourselves. Email verification and password reset by email are out of scope for v1 because they need an email service. An Admin resets passwords instead.
- Adding SSO later means adding a second sign-in path that maps an external identity onto an existing User.
