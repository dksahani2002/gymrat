# Goals — Implementation Notes

Implements Phase 1 goal APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/goals` | Create |
| GET | `/goals` | List (`status`, `type`, cursor) |
| GET | `/goals/:id` | Detail + progress |
| PATCH | `/goals/:id` | Update |
| POST | `/goals/:id/complete` | Mark completed |
| DELETE | `/goals/:id` | Soft delete → `ABANDONED` |

## Types & progress

| Type | Requirements | Current value |
|------|--------------|---------------|
| `STRENGTH` | `exerciseId`, `targetValue` | Best weight kg (stats / PR) |
| `BODY_WEIGHT` | `targetValue` | Latest body weight vs baseline at `startsAt` |
| `FREQUENCY` | `targetValue` | Completed workouts since `startsAt` |
| `VOLUME` | `targetValue` | Sum of daily volume snapshots |
| `CUSTOM` | title only | No auto progress |

Progress `%` is computed on read. Active goals auto-complete at 100% on `workout.completed`, `body_weight.logged`, or `pr.achieved`.
