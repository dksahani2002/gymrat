# Auth Module — Implementation Notes

Implements Phase 1 authentication per [08-authentication-flow.md](./08-authentication-flow.md).

## What shipped

| Capability | Detail |
|------------|--------|
| Register / Login | Argon2id (`@node-rs/argon2`), email normalized |
| JWT access | 15m, claims `sub/role/email/jti` |
| Refresh rotation | Opaque token, SHA-256 at rest, family revoke on reuse |
| Forgot / Reset | Always 202 on forgot; 1h hashed reset tokens |
| Google login | ID token verify via `google-auth-library` |
| Guards | Global JWT + `@Public()` + `@Roles()` |
| Audit | Login/register/reset/logout/reuse events |
| Rate limits | Nest throttler + Redis login sliding window |
| Envelope | `{ success, data, error, meta }` |

## Key paths

- Domain: `src/domain/identity/`
- Use cases: `src/application/identity/auth.application-service.ts`
- HTTP: `src/modules/auth/`
- Prisma migration: `prisma/migrations/*_init_auth/`

## Run

```bash
npm run docker:up
npx prisma migrate dev
npm run start:dev
# Swagger: http://localhost:3000/docs
```

## Next module

User profile (`GET/PATCH /users/me`) can reuse `AuthModule` exports and `USER_REPOSITORY`.
