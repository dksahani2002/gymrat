# 08 — Authentication Flow

## Goals

- Stateless access tokens for horizontal scale
- Rotating refresh tokens to detect theft
- Google OAuth without password
- No email enumeration on forgot-password
- RBAC ready (`USER`, `ADMIN`)

---

## Token Design

| Token | Storage | TTL (MVP default) | Contents |
|-------|---------|-------------------|----------|
| Access JWT | Client memory | 15 minutes | `sub`, `role`, `email`, `jti` |
| Refresh | HttpOnly Secure cookie **or** body (mobile) | 30 days | Opaque random; **only hash in DB** |

### Access JWT claims
```json
{
  "sub": "user-uuid",
  "role": "USER",
  "email": "a@b.com",
  "jti": "jwt-id",
  "iat": 0,
  "exp": 0
}
```

Sign with RS256 (preferred) or HS256 in local dev. Keys via AWS Secrets Manager / env.

---

## Refresh Rotation Protocol

1. Client sends refresh token.
2. Server hashes (`sha256`) and looks up `refresh_tokens`.
3. If valid and not revoked:
   - Mark old token `revoked_at`
   - Issue new refresh in same `family_id`
   - Set `replaced_by_id` on old row
4. If token already revoked but presented again → **reuse detection**:
   - Revoke entire `family_id`
   - Force re-login
5. Optional Redis denylist for `jti` on logout (access token remainder TTL).

---

## Register Flow

1. Validate DTO (class-validator)
2. Normalize email (citext)
3. Reject if email exists (`409`)
4. Hash password with **argon2id**
5. Create `users` + empty `user_profiles` + default `notification_preferences` in a transaction
6. Issue token pair
7. Emit `UserRegistered` (welcome email async)

---

## Login Flow

1. Rate limit by IP + email (Redis sliding window)
2. Find user by email; constant-time compare path even if missing
3. Reject suspended/deleted
4. Verify argon2 hash
5. Update `last_login_at`
6. Issue token pair; persist refresh metadata (UA, IP)
7. Audit successful/failed logins

---

## Forgot / Reset Password

1. `POST /forgot-password` → always `202`
2. If user exists: create `password_reset_tokens` (hash, 1h TTL), email link
3. `POST /reset-password` with token + new password
4. Invalidate token; revoke all refresh families; hash new password
5. Audit event

---

## Google OAuth

**Mobile-friendly path (MVP):** client obtains Google ID token → `POST /auth/google`.

1. Verify token with Google certs (`aud` must match client IDs)
2. Extract `sub`, `email`, `email_verified`
3. Upsert:
   - Match `google_sub`
   - Else match verified email → link `google_sub`
   - Else create user (`password_hash` null)
4. Issue our JWT pair (Google token not reused as session)

**Web path (optional):** authorization code + server exchange; same upsert.

---

## Authorization

- Global `JwtAuthGuard` with `@Public()` escape
- `RolesGuard` + `@Roles(Role.ADMIN)`
- Resource ownership checks in application handlers (`workout.userId === actor.id`)

---

## CSRF Strategy

| Client | Strategy |
|--------|----------|
| Native mobile | Bearer access + refresh in secure storage; no CSRF |
| SPA (same-site) | Access in memory; refresh in **HttpOnly SameSite=strict** cookie; CSRF token for cookie-authenticated refresh **or** require refresh in body only |
| MVP recommendation | Refresh in request body for API clients; document cookie mode for web later |

---

## Security Controls Tied to Auth

- Helmet
- Rate limiting (global + auth endpoints)
- Password complexity policy
- Account lockout after N failures (soft: exponential backoff)
- Audit logs for auth events
- Prisma parameterized queries (SQLi protection)
- DTO whitelist (`forbidNonWhitelisted`) — XSS/injection at API boundary
- Secrets never in logs

---

## Sequence Reference

See [07-sequence-diagrams.md](./07-sequence-diagrams.md) diagrams 1, 2, and 5.
