# On-call Basics (M6)

## Scope

Single primary on-call for the API during soft launch. Escalate to whoever owns Postgres/infra if the host or network is down.

## Severity

| Sev | Example | Response |
|-----|---------|----------|
| SEV1 | API down, auth broken, data loss risk | Page immediately; mitigate within 15m |
| SEV2 | Elevated 5xx, p95 over SLO, partial feature outage | Respond within 1h |
| SEV3 | Non-urgent bug, single-user issue | Next business day |

## First 10 minutes

1. Check `/health` and `/health/ready`
2. Check host/container logs (`docker compose logs api --tail=200`)
3. Check Postgres + Redis healthchecks
4. Check recent deploys / secret changes
5. If burn rate is SEV1: roll back last deploy (see [runbook](./runbook.md))

## Common mitigations

| Symptom | Action |
|---------|--------|
| 5xx after deploy | Rollback image; keep DB |
| Ready probe failing | Fix DB/Redis connectivity; verify `DATABASE_URL` |
| Login 429 storms | Confirm not attack; temporarily raise `AUTH_THROTTLE_LIMIT` if legitimate traffic |
| Stale analytics | Admin recompute for affected user/date range |
| Refresh reuse alerts | Investigate stolen token; user sessions already family-revoked |

## Communications

- Soft launch: notify internal Slack/channel within 15m of SEV1
- External users: status note if outage > 30m
- After SEV1/SEV2: short postmortem within 72h (timeline, impact, action items)

## Handoff

On-call week starts Monday 10:00 local. Handoff includes open incidents, recent deploys, and known flaky dependencies.
