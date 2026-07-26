# 01 — Folder Structure

## Architectural Decision

We use **Clean Architecture + NestJS modules** as the packaging unit.

- **`domain/`** — Pure TypeScript: entities, value objects, domain events, repository *ports*, domain services. Zero Nest/Prisma/HTTP imports.
- **`application/`** — Use cases / commands / queries (CQRS-lite). Orchestrates domain + ports. No HTTP concerns.
- **`infrastructure/`** — Prisma repositories, Redis, BullMQ, S3, AI providers, JWT, Winston.
- **`modules/`** — NestJS wiring: controllers, module providers, guards, interceptors, Swagger. Thin adapters.
- **`shared/`** — Cross-cutting: errors, result types, pagination, logging interfaces, config schemas.

NestJS `modules/` remain the DI composition root so the framework stays at the edges.

---

## Root Layout

```
gymratapp/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── nginx/                    # optional API gateway later
├── docs/                         # this documentation
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│       ├── exercises.seed.ts
│       ├── muscles.seed.ts
│       └── demo-user.seed.ts
├── scripts/
│   ├── generate-erd.ts
│   └── migrate-and-seed.sh
├── test/
│   ├── e2e/
│   ├── fixtures/
│   └── jest-e2e.json
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── modules/
│   └── shared/
├── docker-compose.yml            # postgres, redis, localstack/minio
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
└── README.md
```

---

## `src/` Detail

```
src/
├── main.ts
├── app.module.ts
│
├── config/
│   ├── configuration.ts
│   ├── env.validation.ts
│   ├── auth.config.ts
│   ├── redis.config.ts
│   ├── s3.config.ts
│   └── ai.config.ts
│
├── domain/
│   ├── common/
│   │   ├── entity.base.ts
│   │   ├── aggregate-root.base.ts
│   │   ├── value-object.base.ts
│   │   ├── domain-event.base.ts
│   │   └── repository.port.ts
│   ├── identity/
│   │   ├── user.entity.ts
│   │   ├── refresh-token.entity.ts
│   │   ├── role.enum.ts
│   │   ├── events/
│   │   └── repositories/
│   ├── profile/
│   ├── exercise/
│   ├── workout/
│   ├── analytics/
│   ├── goals/
│   ├── body-metrics/
│   └── notifications/
│
├── application/
│   ├── identity/
│   │   ├── commands/
│   │   │   ├── register.command.ts
│   │   │   ├── login.command.ts
│   │   │   ├── refresh-token.command.ts
│   │   │   ├── forgot-password.command.ts
│   │   │   └── google-login.command.ts
│   │   ├── queries/
│   │   └── handlers/
│   ├── profile/
│   ├── exercise/
│   ├── workout/
│   │   ├── commands/
│   │   │   ├── create-workout.command.ts
│   │   │   ├── update-workout.command.ts
│   │   │   ├── delete-workout.command.ts
│   │   │   └── complete-session.command.ts
│   │   ├── queries/
│   │   │   ├── get-workout-history.query.ts
│   │   │   └── get-workout-by-id.query.ts
│   │   └── handlers/
│   ├── ai-logging/
│   │   ├── commands/
│   │   │   ├── parse-workout-text.command.ts
│   │   │   └── parse-workout-voice.command.ts
│   │   ├── ports/
│   │   │   ├── ai-parser.port.ts
│   │   │   └── speech-to-text.port.ts
│   │   └── handlers/
│   ├── analytics/
│   ├── progressive-overload/
│   ├── body-metrics/
│   ├── goals/
│   ├── calendar/
│   └── notifications/
│
├── infrastructure/
│   ├── persistence/
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   └── mappers/
│   │   └── repositories/
│   │       ├── user.prisma-repository.ts
│   │       ├── workout.prisma-repository.ts
│   │       ├── exercise.prisma-repository.ts
│   │       └── ...
│   ├── cache/
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   ├── queue/
│   │   ├── bullmq.module.ts
│   │   ├── processors/
│   │   │   ├── analytics.processor.ts
│   │   │   ├── ai-parse.processor.ts
│   │   │   ├── notification.processor.ts
│   │   │   └── pr-detection.processor.ts
│   │   └── queues.constants.ts
│   ├── storage/
│   │   ├── s3.module.ts
│   │   └── s3.service.ts
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── providers/
│   │   │   ├── openai-parser.provider.ts
│   │   │   ├── anthropic-parser.provider.ts
│   │   │   └── mock-parser.provider.ts
│   │   └── ai-provider.factory.ts
│   ├── auth/
│   │   ├── jwt/
│   │   ├── google-oauth/
│   │   └── password/
│   ├── mail/
│   │   └── mail.service.ts
│   └── logging/
│       ├── winston.module.ts
│       └── winston.logger.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/
│   ├── users/
│   ├── exercises/
│   ├── workouts/
│   ├── ai/
│   ├── analytics/
│   ├── personal-records/
│   ├── body-metrics/
│   ├── goals/
│   ├── calendar/
│   ├── notifications/
│   └── health/
│
└── shared/
    ├── errors/
    │   ├── base.error.ts
    │   ├── validation.error.ts
    │   ├── business.error.ts
    │   ├── repository.error.ts
    │   ├── authentication.error.ts
    │   └── error-codes.ts
    ├── filters/
    │   └── global-exception.filter.ts
    ├── interceptors/
    │   ├── logging.interceptor.ts
    │   ├── transform.interceptor.ts
    │   └── timeout.interceptor.ts
    ├── middleware/
    │   └── request-id.middleware.ts
    ├── dto/
    │   ├── api-response.dto.ts
    │   ├── pagination.dto.ts
    │   └── cursor-pagination.dto.ts
    ├── decorators/
    │   ├── current-user.decorator.ts
    │   ├── roles.decorator.ts
    │   └── public.decorator.ts
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   ├── roles.guard.ts
    │   └── throttle.guard.ts
    ├── events/
    │   ├── event-bus.port.ts
    │   └── nest-event-bus.ts
    ├── utils/
    │   ├── date.utils.ts
    │   ├── unit-conversion.utils.ts
    │   └── hash.utils.ts
    └── constants/
        ├── roles.ts
        └── queue-names.ts
```

---

## Per-Feature Module Convention

Every Nest feature module under `modules/<feature>/` follows:

```
modules/workouts/
├── workouts.module.ts
├── workouts.controller.ts
├── dto/
│   ├── create-workout.dto.ts
│   ├── update-workout.dto.ts
│   ├── workout-response.dto.ts
│   └── list-workouts.query.dto.ts
├── mappers/
│   └── workout-http.mapper.ts
├── validators/
│   └── workout-exists.validator.ts
└── __tests__/
    ├── workouts.controller.spec.ts
    └── workouts.e2e-spec.ts
```

Domain + application live outside Nest modules; Nest only adapts HTTP ↔ application.

---

## Why Not Hexagonal Folders Only?

NestJS teams ship faster when controllers/DTOs live in `modules/`. Domain purity is preserved by forbidding framework imports in `domain/` and `application/` (enforced via ESLint `no-restricted-imports` and boundary tests).
