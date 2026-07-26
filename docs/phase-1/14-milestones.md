# 14 — Milestones

## M0 — Documentation Sign-off

**Exit**
- Stakeholders approve Phase 1 docs (schema, APIs, overload rules, auth TTLs)
- Implementation order confirmed

## M1 — Platform Skeleton

**Exit**
- App boots in Docker Compose
- CI runs lint + unit tests
- `/health` and `/health/ready` green
- Global error/logging/Swagger wired

## M2 — Identity Complete

**Exit**
- Register/login/refresh/logout/forgot/reset/Google work e2e
- Refresh reuse detection verified by test
- Rate limiting proven on login

## M3 — Logging Loop Complete

**Exit**
- Exercise search works with aliases
- Manual workout CRUD + history
- `parse-text` returns resolvable drafts
- Confirm → create → complete path works
- Voice path works with mock STT in CI

## M4 — Intelligence Read Models

**Exit**
- PRs created on complete
- Analytics overview + volume/muscle/e1RM charts
- Overload recommendations return rationale
- Snapshot recompute idempotent

## M5 — MVP Feature Complete

**Exit**
- Body weight, measurements, goals, calendar, notifications live
- Security hardening checklist signed
- Staging deployment with migrations
- Test coverage ≥ 80% on domain/application; critical e2e suite green
- Runbook: deploy, rollback, recompute analytics

## M6 — Production Readiness (Launch)

**Exit**
- Prod secrets, backups, alerts
- Error budget / SLOs defined (availability, p95 latency)
- On-call basics
- Soft launch feature flags if needed
