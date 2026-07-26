# Secrets & Backups (M6)

## Secrets inventory

| Secret | Where used | Rotation |
|--------|------------|----------|
| `JWT_ACCESS_SECRET` | Access token signing | Rotate → force re-login (refresh families still valid until expiry/reuse) |
| `DATABASE_URL` / DB password | Prisma | Rotate with dual-user cutover |
| `REDIS_URL` | Cache, login rate limit | Rotate password; expect cache cold start |
| `GOOGLE_CLIENT_IDS` | Google ID token audience | Update both old+new during client migration |
| `OPENAI_API_KEY` | Optional AI provider | Rotate in provider console |
| SMTP / mail credentials | Password reset (when wired) | Rotate quarterly |

Rules:

- Never commit secrets; use a secret manager (AWS Secrets Manager, GCP Secret Manager, Doppler, etc.).
- Staging and production secrets must differ.
- `MAIL_LOG_RESET_TOKENS` must be `false` outside local machines.

## Postgres backups

**Staging:** daily logical dump retained 7 days.

```bash
docker compose -f docker-compose.staging.yml exec -T postgres \
  pg_dump -U gymrat -d gymrat -Fc > "gymrat-staging-$(date -u +%Y%m%d).dump"
```

**Production:**

- Automated continuous WAL archiving **or** daily `pg_dump` + weekly full base backup
- Retain ≥ 14 daily + 4 weekly
- Encrypt at rest; store off-host
- Quarterly restore drill into an isolated database; document RTO/RPO

Target RPO ≤ 24h (soft launch); RTO ≤ 4h.

## Redis

Treat as ephemeral cache. No durable backup required for Phase 1. After Redis loss: cold analytics/overload caches and reset login rate-limit counters.

## Restore drill checklist

1. Provision empty Postgres
2. Restore latest dump
3. Point a read-only API at restored DB
4. Spot-check auth user, one completed workout, analytics daily row
5. Record time-to-restore in the incident log
