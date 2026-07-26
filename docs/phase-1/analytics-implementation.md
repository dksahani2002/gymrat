# Analytics — Implementation Notes

Implements Phase 1 analytics from [10-analytics-engine.md](./10-analytics-engine.md) and [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/analytics/overview` | Streak, week volume, 28d consistency (Redis cached) |
| GET | `/analytics/volume` | `period=day\|week\|month\|year` |
| GET | `/analytics/volume/exercise/:exerciseId` | Per-exercise daily volume |
| GET | `/analytics/volume/muscle` | Breakdown; `series=true` for daily |
| GET | `/analytics/estimated-1rm` | Epley series (`exerciseId` required) |
| GET | `/analytics/frequency` | Workouts / trained days |
| GET | `/analytics/consistency` | Trained / target days (default 28) |
| GET | `/analytics/duration` | Duration series |
| GET | `/analytics/charts/:chartType` | Normalized `{ chartType, unit, points }` |

`body_weight_over_time` reads soft-deletable `body_weight_entries` (see [body-weight-implementation.md](./body-weight-implementation.md)).

## Recompute

On `workout.completed` / `workout.deleted` (awaited `emitAsync`):

1. Resolve user timezone
2. Upsert `analytics_daily_snapshots` for local date
3. Replace `muscle_volume_daily` (primary ×1, secondary ×0.5)
4. Upsert `analytics_weekly_snapshots` (ISO week Mon–Sun)
5. Upsert `exercise_stats` for touched exercises
6. Invalidate `analytics:{userId}:*` Redis keys
