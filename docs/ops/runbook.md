# Deploy / Rollback / Analytics Runbook (M5)

## Prerequisites

- Node 20+, Docker Compose
- Staging secrets in `.env.staging` (never commit)
- Access to Postgres + Redis for the target environment

## Staging deploy

```bash
cp .env.example .env.staging
# Edit JWT_ACCESS_SECRET, GOOGLE_CLIENT_IDS, APP_URL, FRONTEND_URL, DB password

docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
docker compose -f docker-compose.staging.yml logs -f api
```

Verify:

```bash
curl -sS http://127.0.0.1:3000/api/v1/health
curl -sS http://127.0.0.1:3000/api/v1/health/ready
```

Migrations run via the one-shot `migrate` service (`prisma migrate deploy`) before `api` starts.

Optional catalog seed (one-off):

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging run --rm \
  -e DATABASE_URL=postgresql://gymrat:PASSWORD@postgres:5432/gymrat?schema=public \
  api npx ts-node --transpile-only prisma/seed/exercises.seed.ts
```

(Prefer running seed from a CI job or bastion with `npm run prisma:seed` against staging `DATABASE_URL`.)

## Local / VM deploy (without Compose API)

```bash
npm ci
npx prisma migrate deploy
npm run build
NODE_ENV=production npm run start:prod
```

## Rollback

1. **App only:** redeploy the previous image tag / `dist` artifact; leave DB as-is if migrations are backward-compatible.
2. **Failed migration:** restore Postgres from the last snapshot (see [secrets-and-backups](./secrets-and-backups.md)), then redeploy the prior app version. Do **not** hand-edit `_prisma_migrations` unless an incident lead approves.
3. **Bad config:** revert env/secret change and restart the API process (`docker compose ... up -d api`).

Record the git SHA and image digest of the known-good release before each promote.

## Recompute analytics

Snapshots are event-driven on workout complete/delete. Use recompute when history was backfilled or snapshots look wrong.

### Admin API (preferred)

Requires a user with `role=ADMIN`.

```bash
curl -sS -X POST "$APP_URL/api/v1/admin/analytics/recompute" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","from":"2026-01-01","to":"2026-07-26"}'
```

Response includes `{ days }` processed. Range max 366 days (same as chart APIs).

### CLI script

```bash
export DATABASE_URL=...
export REDIS_URL=...
# plus other required env from .env.example
npx ts-node --transpile-only scripts/recompute-analytics.ts \
  --userId <uuid> --from 2026-01-01 --to 2026-07-26
```

Recompute is idempotent: daily/weekly/muscle/exercise rows are upserted for each local date.
