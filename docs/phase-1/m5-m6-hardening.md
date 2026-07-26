# M5 / M6 Hardening Implementation

## M5 — MVP feature complete (ops)

Product modules (body weight, measurements, goals, calendar, notifications) shipped earlier. This pass closes the milestone ops exits:

| Exit | Delivery |
|------|----------|
| Security checklist | [`docs/ops/security-checklist.md`](../ops/security-checklist.md) |
| Staging deploy + migrations | `Dockerfile`, `docker-compose.staging.yml`, [runbook](../ops/runbook.md) |
| Coverage ≥ 80% domain/application | Jest `collectCoverageFrom` + `coverageThreshold` (statements/lines) |
| Critical e2e green | GitHub Actions `e2e` job (Postgres + Redis services) |
| Runbook | Deploy, rollback, analytics recompute |

Admin recompute: `POST /admin/analytics/recompute` (`ADMIN` role) and `scripts/recompute-analytics.ts`.

## M6 — Production readiness

| Exit | Delivery |
|------|----------|
| Secrets / backups | [`docs/ops/secrets-and-backups.md`](../ops/secrets-and-backups.md) |
| SLOs / error budget | [`docs/ops/slos.md`](../ops/slos.md) |
| On-call basics | [`docs/ops/on-call.md`](../ops/on-call.md) |
| Soft-launch flags | Env flags + [`docs/ops/feature-flags.md`](../ops/feature-flags.md) |

## CI

`.github/workflows/ci.yml` runs lint, `test:cov` (threshold enforced), build, and e2e.
