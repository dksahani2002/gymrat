# GymRat API

AI-powered fitness platform backend (NestJS). Phase 1 authentication is implemented.

## Prerequisites

- Node.js 20+
- Docker (Postgres 16 + Redis 7)

## Quick start

```bash
cp .env.example .env
npm run docker:up
npm install
npx prisma migrate dev --name init_auth
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/api/v1/health`

## Auth endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public |
| POST | `/auth/logout` | Bearer |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| POST | `/auth/google` | Public |
| GET | `/auth/me` | Bearer |

## Profile endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/users/me` | Bearer |
| PATCH | `/users/me` | Bearer |
| DELETE | `/users/me` | Bearer |
| GET | `/users/me/preferences` | Bearer |
| PATCH | `/users/me/preferences` | Bearer |

## Exercise endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/exercises` | Bearer |
| GET | `/exercises/:id` | Bearer |
| GET | `/exercises/categories` | Bearer |
| GET | `/exercises/muscles` | Bearer |
| GET | `/exercises/equipment` | Bearer |
| POST | `/exercises` | Bearer |
| PATCH | `/exercises/:id` | Bearer |
| DELETE | `/exercises/:id` | Bearer |

Seed catalog: `npm run prisma:seed`

## Workout endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/workouts` | Bearer |
| GET | `/workouts` | Bearer |
| GET | `/workouts/:id` | Bearer |
| PATCH | `/workouts/:id` | Bearer |
| DELETE | `/workouts/:id` | Bearer |
| POST | `/workouts/:id/complete` | Bearer |
| POST/PATCH/DELETE | `/workouts/:id/exercises...` | Bearer |
| POST/PATCH/DELETE | `/workouts/:id/.../sets` | Bearer |

## AI parser endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/ai/parse-text` | Bearer |
| POST | `/ai/parse-voice` | Bearer (multipart `audio`) |
| POST | `/ai/parse-image` | Bearer (501 stub) |
| GET | `/ai/parse-logs` | Bearer |

Drafts only — confirm via `POST /workouts`. See `docs/phase-1/ai-parser-implementation.md`.

## Personal records endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/personal-records` | Bearer |
| GET | `/personal-records/summary` | Bearer |

Detected on `workout.completed`. See `docs/phase-1/personal-records-implementation.md`.

## Tests

```bash
npm test
npm run test:e2e
```

## Architecture

Clean Architecture layout under `src/`:

- `domain/identity` — entities, ports
- `application/identity` — auth use cases
- `infrastructure` — Prisma, JWT, Argon2id, Google, Redis, mail
- `modules/auth` — HTTP controllers / DTOs / Swagger

See `docs/phase-1/08-authentication-flow.md` for the full design.
