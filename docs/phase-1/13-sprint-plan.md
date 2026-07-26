# 13 — Sprint Plan

**Cadence:** 2-week sprints  
**Team assumption:** 2 backend engineers (adjust velocity if different)  
**Definition of Done:** code + unit tests + Swagger + migration (if any) + integration/e2e for happy path + docs update

---

## Sprint 0 — Scaffold (1 week, parallel kickoff)

- NestJS monorepo/app bootstrap, ESLint boundaries, CI skeleton
- Docker Compose: Postgres, Redis, MinIO
- Prisma init, config validation, Winston, Helmet, global filters
- Health endpoints, ApiResponse envelope
- **Deliverable:** empty deployable service

## Sprint 1 — Auth

- Register, login, refresh rotation, logout
- Forgot/reset password
- Google login
- Guards, roles, rate limits on auth
- Tests: unit + e2e auth flows

## Sprint 2 — Profile + Exercise Catalog

- User profile CRUD
- Muscle/equipment/category/exercise/alias models
- Seed script (≥200 common exercises + aliases)
- Search API + Redis catalog cache
- Admin exercise mutations

## Sprint 3 — Workout Core

- Workout aggregate CRUD + nested sets
- Idempotency keys
- History cursor pagination
- Soft delete + ownership checks
- Complete workout → domain events stub

## Sprint 4 — AI Logging

- `AiWorkoutParserPort` + mock + OpenAI provider
- parse-text endpoint + resolver
- parse-voice (STT port + S3)
- AI parse logs + rate limits
- parse-image stub

## Sprint 5 — PRs + Analytics + Overload

- PR detection worker
- Analytics snapshots + chart APIs
- Streak/consistency/overview
- Progressive overload algorithm + APIs
- Cache invalidation

## Sprint 6 — Body Metrics, Goals, Calendar, Notifications

- Body weight + measurements
- Goals CRUD + progress hooks
- Calendar endpoints
- In-app notifications + prefs + email for PR/reset
- Push token registration (send optional)

## Sprint 7 — Hardening & Launch Prep

- Load test critical paths
- Security review (OWASP checklist)
- OpenAPI polish, runbooks
- Docker production image, ECS/K8s manifests
- Coverage gates, migration runbook
- Staging soak

---

## Sprint Ceremonies (lightweight)

- Day 1: refine tickets from this plan
- Mid-sprint: API contract review with client app
- End: demo against Swagger + Postman collection
