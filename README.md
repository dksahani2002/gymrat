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
