# AI Fitness Platform — Backend Documentation

> Production SaaS backend for an AI-powered fitness coach that eliminates manual workout tracking.

**Status:** Phase 1 documentation complete. Implementation begins module-by-module after review.  
**Stack:** NestJS · TypeScript · PostgreSQL · Prisma · Redis · BullMQ · AWS S3 · JWT/OAuth

---

## Documentation Index

### Phase 1 — MVP Backend (Document → Implement)

| # | Document | Description |
|---|----------|-------------|
| 0 | [Architecture Decisions](./phase-1/00-architecture-decisions.md) | ADRs constraining implementation |
| 1 | [Folder Structure](./phase-1/01-folder-structure.md) | Clean Architecture layout |
| 2 | [Module Breakdown](./phase-1/02-module-breakdown.md) | Bounded contexts & responsibilities |
| 3 | [Database Design](./phase-1/03-database-design.md) | Schema, indexes, soft deletes, audit |
| 4 | [Prisma Models](./phase-1/04-prisma-models.md) | Full Prisma schema draft |
| 5 | [API List](./phase-1/05-api-list.md) | Complete REST surface |
| 6 | [ER Diagram](./phase-1/06-erd.md) | Entity relationships (Mermaid) |
| 7 | [Sequence Diagrams](./phase-1/07-sequence-diagrams.md) | Key system interactions |
| 8 | [Authentication Flow](./phase-1/08-authentication-flow.md) | JWT, refresh, Google OAuth |
| 9 | [Workout Logging Flow](./phase-1/09-workout-logging-flow.md) | Text/voice → structured data |
| — | [AI Parser Implementation](./phase-1/ai-parser-implementation.md) | Parse-text/voice ports, rules parser, logs |
| — | [Personal Records Implementation](./phase-1/personal-records-implementation.md) | PR detection on workout.completed |
| — | [Analytics Implementation](./phase-1/analytics-implementation.md) | Snapshots, streak, charts |
| — | [Progressive Overload Implementation](./phase-1/progressive-overload-implementation.md) | Next weight/reps suggestions |
| — | [Body Weight Implementation](./phase-1/body-weight-implementation.md) | Weight logging + chart series |
| — | [Measurements Implementation](./phase-1/measurements-implementation.md) | Circumference logging (cm) |
| — | [Goals Implementation](./phase-1/goals-implementation.md) | Goal CRUD + progress |
| 10 | [Analytics Engine](./phase-1/10-analytics-engine.md) | Volume, PRs, charts, jobs |
| 11 | [Progressive Overload](./phase-1/11-progressive-overload.md) | Algorithm & recommendation rules |
| 12 | [Project Roadmap](./phase-1/12-roadmap.md) | Phased delivery |
| 13 | [Sprint Plan](./phase-1/13-sprint-plan.md) | 2-week sprints |
| 14 | [Milestones](./phase-1/14-milestones.md) | Exit criteria |
| 15 | [Risks](./phase-1/15-risks.md) | Risk register |
| 16 | [Estimated Timeline](./phase-1/16-timeline.md) | Effort & calendar |

### Phase 2 — Intelligence Layer (Docs Only)

- [Phase 2 Implementation Guide](./phase-2/README.md)

### Phase 3 — Scale & Platform (Docs Only)

- [Phase 3 Implementation Guide](./phase-3/README.md)

---

## Architectural North Stars

1. **Natural input first** — Text/voice/OCR → structured workout; forms are fallback.
2. **History-driven intelligence** — Recommendations come from the user's data, never generic templates alone.
3. **Clean Architecture** — Domain has no Nest/Prisma imports; infrastructure is swappable.
4. **Async by default** — AI parse, analytics recompute, notifications run on BullMQ.
5. **Provider-agnostic AI** — `AiProvider` port; OpenAI/Anthropic/local models plug in behind it.
6. **Observability from day one** — Structured logs, audit trail, request IDs, metrics hooks.
7. **Multi-tenant ready** — User-scoped data, RBAC, soft deletes, eventual org/coach tenancy in Phase 3.

---

## Implementation Order (After Doc Sign-off)

```
1. Project scaffold + shared kernel
2. Auth
3. User / Profile
4. Exercise catalog
5. Workout + Session + Sets
6. AI parse-text (provider abstraction)
7. Personal Records
8. Analytics + Progressive Overload
9. Body weight / Measurements / Goals
10. Calendar + Notifications
11. Hardening (rate limit, Helmet, CI, Docker)
```

Each module ships with: folder structure, migrations, DTOs, entities, services, controllers, repositories, tests, Swagger, validation, and error handling.

---

## Review Checklist Before Coding

- [ ] Confirm Phase 1 module scope
- [ ] Approve Prisma schema & indexing strategy
- [ ] Approve API contracts (esp. AI parse response shape)
- [ ] Confirm progressive overload defaults
- [ ] Confirm auth token TTLs & refresh rotation policy
- [ ] Confirm deployment target (ECS vs Kubernetes) for infra docs
