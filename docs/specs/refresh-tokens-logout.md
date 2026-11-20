# Refresh tokens and logout

Epic: #28

## Problem
The API issues a single JWT that lives `JWT_EXPIRES_IN`, so a frontend cannot test the most delicate auth flow: the access token expires mid-session, an HTTP interceptor renews it silently and retries the original request. There is also no real logout to test.

## Users / consumers
- Frontend dashboards built on this mock (ERA UI first, other projects later) that implement a refresh interceptor and a logout button.
- Their e2e/manual tests (Bruno, Playwright, etc.) that need to reproduce expiry, refresh failure and logout.

## Goals
- `POST /auth/login` also returns an opaque refresh token in the JSON body.
- `POST /auth/refresh` rotates it: each call returns a new access + refresh pair and the old refresh token stops working.
- `POST /auth/logout` invalidates a refresh token.
- Reusing an already-rotated refresh token revokes its whole family (Should).
- An expired access token answers `401` with `message: "Token expired"` (Could).

## Non-goals (Won't)
- Refresh token in an `httpOnly` cookie (CORS with credentials, `cookie-parser`, CSRF). Possible future epic.
- An `x-mock-token-expired` header: a short `JWT_EXPIRES_IN` gives real expiry and `x-mock-status: 401` forces a 401 at once.
- "Log out everywhere" (revoke all sessions of a user).
- Blocklist of access tokens: after logout the access token stays valid until it expires.
- A grace window for parallel refreshes with the same token (strict rotation).
- Persisting refresh tokens across restarts.

## Success criteria
- With `JWT_EXPIRES_IN=30s`, a frontend logs in, waits, gets a `401`, calls `POST /auth/refresh`, retries and succeeds, without user interaction.
- After `POST /auth/logout`, `POST /auth/refresh` with that token returns `401`.
- e2e tests in `test/auth.e2e-spec.ts` cover login, refresh, rotation, logout, reuse and expiry; the `bruno/Auth/` requests run green.

## Assumptions
- The refresh token travels only in the JSON body (`{ refreshToken }`), never in a header or cookie.
- The refresh token is an opaque random string stored in memory, not a JWT.
- `JWT_REFRESH_EXPIRES_IN` uses the same format as `JWT_EXPIRES_IN` (e.g. `7d`), defaults to `7d` so CI and Docker work without `.env`, and an invalid value stops the app on boot.
- `POST /auth/refresh` and `POST /auth/logout` are public: the access token is usually expired when they are called.
- A restart or `POST /seed/reset` drops every refresh token; the consumer must log in again.
- All refresh failures answer the same `401` message, `Invalid refresh token`.
- Strict rotation: two parallel refreshes with the same token → the first wins, the second gets `401`. Frontends must single-flight their refresh.

## Open questions
- None at the moment.

## Risks and edge cases
- Parallel refreshes (see assumptions): documented in `docs/features.md`; with family revocation (story 3) the second call also revokes the first call's new token.
- Interceptor loops: a `401` from `/auth/refresh` itself must not trigger another refresh. Documented as a consumer note.
- `MOCK_ERROR_RATE` can return a random `500` on `/auth/refresh`; consumers should not treat it as a logout. Documented.
- `x-mock-status` on `/auth/refresh` skips the handler, so the refresh token is not consumed.
- Deleted user: refresh returns `401`. Changed role: the new access token carries the current role.
- Memory growth: expired tokens are deleted lazily when read.
- Login's response gains a field (`refreshToken`): additive, not breaking.
