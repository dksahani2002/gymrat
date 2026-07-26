# Security Hardening Checklist (M5)

Sign off before promoting a build to staging or production.

## Transport & headers

- [x] Helmet enabled (HSTS only in `production`)
- [x] CORS restricted to `FRONTEND_URL`
- [x] HTTPS terminated at load balancer / reverse proxy in staging+prod
- [ ] TLS certificate monitoring / auto-renewal configured

## Auth & sessions

- [x] Access JWT short-lived (`JWT_ACCESS_EXPIRES_IN`, default 15m)
- [x] Refresh token rotation + family reuse detection
- [x] Passwords hashed with Argon2id
- [x] Login rate limited (`AUTH_THROTTLE_LIMIT` + Redis)
- [x] Global API throttle (`THROTTLE_LIMIT`)
- [x] Soft-delete account revokes refresh families
- [ ] Production `JWT_ACCESS_SECRET` ≥ 32 chars, unique, rotated procedure documented
- [ ] Google OAuth client IDs limited to prod apps only

## Input & data

- [x] `ValidationPipe` whitelist + forbidNonWhitelisted
- [x] UUID path params validated where applicable
- [x] Soft deletes for user-owned resources
- [x] Audit log on mutating identity/workout/goal actions
- [ ] PII retention / export policy reviewed

## Secrets & config

- [x] `.env` gitignored; `.env.example` has placeholders only
- [x] Env validated at bootstrap (`validateEnv`)
- [ ] Staging/prod secrets in a vault / secret manager (not compose files)
- [ ] `MAIL_LOG_RESET_TOKENS=false` in every non-local environment

## Surfaces

- [x] Swagger disabled when `NODE_ENV=production`
- [x] Admin analytics recompute requires `ADMIN` role
- [x] Feature flags for soft-launch surfaces (voice/image/Google)
- [ ] WAF / IP allowlist for admin routes (optional)

## Ops

- [x] `/health` and `/health/ready` endpoints
- [x] CI: lint, unit coverage gate, e2e against Postgres+Redis
- [ ] Dependency scanning (Dependabot / Snyk) enabled
- [ ] Container image scanned before deploy

**Signed off by:** _________________ **Date:** _________________
