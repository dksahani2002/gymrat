# SLOs & Error Budget (M6)

Phase 1 soft-launch targets. Revisit after 2 weeks of production traffic.

## Service level objectives

| SLO | Target | Measurement |
|-----|--------|-------------|
| Availability | 99.5% monthly | Successful non-5xx responses / total (exclude 401/403/404) |
| Latency p95 | ≤ 400 ms | Authenticated read endpoints (`/analytics/*`, `/workouts`, `/exercises`) |
| Latency p95 writes | ≤ 800 ms | Workout complete, AI parse-text |
| Auth login success | ≥ 99% of valid credential attempts | Exclude rate-limited (429) |
| Ready probe | ≥ 99.9% | `/health/ready` returns 200 |

## Error budget

At 99.5% availability, monthly budget ≈ **3.6 hours** of equivalent downtime (or ~0.5% failed requests).

Burn alerts (suggested):

| Window | Burn rate | Action |
|--------|-----------|--------|
| 1 hour | 14× | Page on-call |
| 6 hours | 6× | Ticket + investigate |
| 3 days | 1× | Review in standup |

## Latency / dependency notes

- Postgres and Redis outages count against availability.
- AI parse-voice depends on STT provider; failures should surface as 5xx/422 and burn budget unless soft-launched off via `FEATURE_VOICE_PARSE=false`.
- Exclude intentional 501 stubs (e.g. parse-image when disabled) from error-rate numerators.

## Dashboards (minimum)

1. Request rate, error rate, p50/p95 latency by route group
2. Postgres connections / slow queries
3. Redis memory + command latency
4. Auth: login failures, refresh reuse events, 429 counts
